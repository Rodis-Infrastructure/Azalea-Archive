import ContextMenuCommand from "./ContextMenuCommand";
import ChatInputCommand from "./ChatInputCommand";

import {
    MessageContextMenuCommandInteraction,
    UserContextMenuCommandInteraction,
    ApplicationCommandDataResolvable,
    ChatInputCommandInteraction,
    ApplicationCommandType,
    TextChannel,
    Collection,
    Client
} from "discord.js";

import {InteractionResponseType, StringCommandType} from "../../../utils/Types";
import {hasInteractionPermission} from "../../../utils/RestrictionUtils";
import {commandManager, globalGuildConfigs} from "../../../Client";
import {sendLog} from "../../../utils/LoggingUtils";
import {readdir} from "node:fs/promises";
import {join} from "node:path";

type Command = ChatInputCommand | ContextMenuCommand;
type CommandInteraction =
    ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction;

export default class CommandHandler {
    client: Client;
    list: Collection<string, Command>;

    constructor(client: Client) {
        this.client = client;
        this.list = new Collection();
    }

    public async load() {
        const directories = await readdir(join(__dirname, "../../../interactions/commands"));

        for (const directory of directories) {
            const files = await readdir(join(__dirname, `../../../interactions/commands/${directory}`));
            for (const file of files) {
                if (!file.endsWith(".js")) continue;

                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const command = require(join(__dirname, `../../../interactions/commands/${directory}`, file)).default;
                await this.register(new command());
            }
        }
    }

    public async register(command: Command) {
        this.list.set(`${command.name}_${command.type}`, command);
    }

    public async publish() {
        const commandData: ApplicationCommandDataResolvable[] = await Promise.all(
            commandManager.list.map(command => command.build())
        );

        try {
            await this.client.application?.commands.set(commandData);
            console.log(`Successfully loaded ${commandManager.list.size} commands!`);
        } catch (err) {
            console.error(err);
        }
    }

    public async handle(interaction: CommandInteraction) {
        const config = globalGuildConfigs.get(interaction.guildId as string);

        if (!config) {
            await interaction.reply({
                content: "Guild not configured.",
                ephemeral: true
            });
            return;
        }

        let stringCommandType: StringCommandType;
        let logCommandName: "Slash" | "Message" | "User";
        let memberUsedOnId = "";

        switch (interaction.commandType) {
            case ApplicationCommandType.ChatInput: {
                stringCommandType = "slashCommands";
                logCommandName = "Slash";
                break;
            }

            case ApplicationCommandType.Message: {
                memberUsedOnId = interaction.targetMessage.member?.id as string;
                stringCommandType = "messageCommands";
                logCommandName = "Message";
                break;
            }

            case ApplicationCommandType.User: {
                memberUsedOnId = interaction.targetId;
                stringCommandType = "userCommands";
                logCommandName = "User";
                break;
            }
        }

        let memberRoles = interaction.member?.roles;
        if (memberRoles && !Array.isArray(memberRoles)) memberRoles = memberRoles?.cache.map(role => role.id);

        const hasPermission = hasInteractionPermission({
            interactionCustomId: interaction.commandName,
            memberRoles: memberRoles as string[],
            interactionType: stringCommandType,
            config
        });

        if (!hasPermission) {
            await interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true
            });
            return;
        }

        const command = this.list.get(`${interaction.commandName}_${interaction.commandType}`);
        if (!command) {
            await interaction.reply({
                content: "Unable to execute command.",
                ephemeral: true
            });
            return;
        }

        let ResponseType = command.defer;
        if (
            config.forceEphemeralResponse &&
            !command.skipInternalUsageCheck &&
            !config.forceEphemeralResponse.excludedChannels?.includes(interaction.channelId as string) &&
            !config.forceEphemeralResponse.excludedCategories?.includes((interaction.channel as TextChannel).parentId as string)
        ) ResponseType = InteractionResponseType.EphemeralDefer;

        switch (ResponseType) {
            case InteractionResponseType.Defer: {
                await interaction.deferReply();
                break;
            }

            case InteractionResponseType.EphemeralDefer: {
                await interaction.deferReply({ephemeral: true});
            }
        }

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await command.execute(interaction, this.client);
        } catch (err) {
            console.log(`Failed to execute command: ${command.name}`);
            console.error(err);
            return;
        }

        if (
            config.logging?.commandUsage?.enabled &&
            config.logging.commandUsage.channelId &&
            !config.logging.excludedChannels?.includes(interaction.channelId) &&
            !config.logging.excludedCategories?.includes((interaction.channel as TextChannel).parentId as string)
        ) {
            const contextCommandField = [];

            if (
                interaction.commandType === ApplicationCommandType.User ||
                interaction.commandType === ApplicationCommandType.Message
            ) contextCommandField.push({
                name: "Used On",
                value: `<@${memberUsedOnId}> (\`${memberUsedOnId}\`)`
            });

            const commandUseLogsChannel = await interaction.guild?.channels.fetch(config.logging.commandUsage.channelId) as TextChannel;
            await sendLog({
                action: "Interaction Used",
                author: interaction.user,
                logsChannel: commandUseLogsChannel,
                color: config.colors?.default,
                icon: "InteractionIcon",
                content: `${logCommandName} Command \`${interaction.commandName}\` used by ${interaction.user} (\`${interaction.user.id}\`)`,
                fields: [
                    {
                        name: "Channel",
                        value: `${interaction.channel} (\`#${(interaction.channel as TextChannel).name}\`)`
                    },
                    ...contextCommandField
                ]
            });
        }
    }
}