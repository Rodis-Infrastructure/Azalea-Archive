import ContextMenuCommand from "./ContextMenuCommand";
import Properties from "../../../utils/Properties";
import ChatInputCommand from "./ChatInputCommand";
import LoggingUtils from "../../../utils/LoggingUtils";
import Bot from "../../../Bot";

import RestrictionUtils, {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

import {
    ApplicationCommandDataResolvable,
    Collection,
    GuildMember,
    ChatInputCommandInteraction,
    UserContextMenuCommandInteraction,
    MessageContextMenuCommandInteraction,
    TextChannel
} from "discord.js";

type Command = ChatInputCommand | ContextMenuCommand;
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
        const directories = readdirSync(join(__dirname, "../../../interactions/commands"));

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
        this.list.set(`${command.name}_${command.type}`, command);
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
        const command = this.list.get(`${interaction.commandName}_${interaction.commandType}`);
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

        if (!await RestrictionUtils.verifyAccess(command.restriction, interaction.member as GuildMember)) {
            await interaction.editReply({
                content:
                    `You are **below** the required restriction level for this interaction: \`${RestrictionLevel[command.restriction]}\`\n`
                    + `Your restriction level: \`${RestrictionUtils.getRestrictionLabel(interaction.member as GuildMember)}\``,
            });
            return;
        }

        try {
            if (
                !Properties.preventLoggingEventsChannels.includes(interaction.channelId) &&
                !Properties.preventLoggingEventsCategories.includes((interaction.channel as TextChannel).parentId as string)
            ) {
                const commandUseLogsChannel = await interaction.guild?.channels.fetch(Properties.channels.commandUseLogs) as TextChannel;
                await LoggingUtils.log({
                    action: "Interaction Used",
                    author: interaction.user,
                    logsChannel: commandUseLogsChannel,
                    icon: "InteractionIcon",
                    content: `Command \`${interaction.commandName}\` used by ${interaction.user} (\`${interaction.user.id}\`)`,
                    fields: [{
                        name: "Channel",
                        value: `${interaction.channel} (\`#${(interaction.channel as TextChannel).name}\`)`
                    }]
                });
            }

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await command.execute(interaction, this.client);
        } catch (err) {
            console.log(`Failed to execute command: ${command.name}`);
            console.error(err);
        }
    }
}