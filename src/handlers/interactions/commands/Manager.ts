import {ResponseType} from "../../../utils/Properties";
import {
    ApplicationCommandDataResolvable,
    Collection,
    GuildMember,
    ChatInputCommandInteraction,
    UserContextMenuCommandInteraction,
    MessageContextMenuCommandInteraction
} from "discord.js";
//import RestrictionUtils, {RestrictionLevel} from "../../../utils/RestrictionUtils";

import ChatInputCommand from "./ChatInputCommand";
import MessageCommand from "./MessageCommand";
import Bot from "../../../Bot";

type Command = ChatInputCommand | MessageCommand;
type CommandInteraction =
    ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction;

import {readdirSync} from "fs";
import {join} from "path";

export default class CommandHandler {
    client: Bot;
    list: Collection<string, Command>;

    constructor(client: Bot) {
        this.client = client;
        this.list = new Collection();
    }

    public async load() {
        const directories = ["application", "message"];

        for (const directory of directories) {
            const files = readdirSync(join(__dirname, `../../../interactions/commands/${directory}`));
            for (const file of files) {
                if (!file.endsWith(".js")) continue;

                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const command = require(join(__dirname, `../../../interactions/commands/${directory}`, file)).default;
                new command(this.client);
            }
        }
    }

    public async register(command: Command) {
        this.list.set(command.name, command);
    }

    public async publish() {
        const commands: ApplicationCommandDataResolvable[] = await Promise.all(
            this.client.commands.list.map(command => command.build())
        );

        try {
            await this.client.application?.commands.set(commands);
            console.log(`Successfully loaded ${this.client.commands.list.size} commands!`);
        } catch (err) {
            console.error(err);
        }
    }

    public async handle(interaction: CommandInteraction) {
        const command = this.list.get(interaction.commandName);
        if (!command) return;

        switch (command.defer) {
            case ResponseType.Defer: {
                await interaction.deferReply();
                break;
            }

            case ResponseType.EphemeralDefer: {
                await interaction.deferReply({ephemeral: true});
            }
        }

        //        if (!await RestrictionUtils.verifyAccess(command.restriction, interaction.member as GuildMember)) {
        //            await interaction.editReply({
        //                content:
        //                    `You are **below** the required restriction level for this command: \`${RestrictionLevel[command.restriction]}\`\n`
        //                    + `Your restriction level: \`${await RestrictionUtils.getRestrictionLabel(interaction.member as GuildMember)}\``,
        //            });
        //            return;
        //        }

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await command.execute(interaction, this.client);
        } catch (err) {
            console.log(`Failed to execute command: ${command.name}`);
            console.error(err);
        }
    }
}