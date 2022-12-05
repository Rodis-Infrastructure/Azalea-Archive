import {ApplicationCommandDataResolvable, Collection, GuildMember, ChatInputCommandInteraction} from "discord.js";
//import RestrictionUtils, {RestrictionLevel} from "../../../utils/RestrictionUtils";

import Command, {ResponseType} from "./Command";
import Bot from "../../../../Bot";

import {readdirSync} from "fs";
import {join} from "path";

export default class CommandHandler {
    client: Bot;
    commands: Collection<string, Command>;

    constructor(client: Bot) {
        this.client = client;
        this.commands = new Collection();
    }

    public async load() {
        const files = readdirSync(join(__dirname, "../../../../interactions/commands/application"))
            .filter(file => file.endsWith(".js"));

        for (const file of files) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const command = require(join(__dirname, "../../../../interactions/commands/application", file)).default;
            new command(this.client);
        }
    }

    public async register(command: Command) {
        this.commands.set(command.name, command);
    }

    public async publish() {
        const commands: ApplicationCommandDataResolvable[] = await Promise.all(
            this.client.application_commands.commands.map(command => command.build())
        );

        try {
            await this.client.application?.commands.set(commands);
            console.log(`Successfully loaded ${this.client.application_commands.commands.size} commands!`);
        } catch (err) {
            console.error(err);
        }
    }

    public async handle(interaction: ChatInputCommandInteraction) {
        const command = this.commands.get(interaction.commandName);
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