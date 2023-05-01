import ContextMenuCommand from "./ContextMenuCommand";
import ChatInputCommand from "./ChatInputCommand";
import ClientManager from "../../../Client";

import {
    ApplicationCommandDataResolvable,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    Collection,
    EmbedBuilder,
    GuildTextBasedChannel,
    MessageContextMenuCommandInteraction,
    UserContextMenuCommandInteraction
} from "discord.js";

import { InteractionResponseType, LoggingEvent } from "../../../utils/Types";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sendLog } from "../../../utils/LoggingUtils";

type Command = ChatInputCommand | ContextMenuCommand;
type CommandInteraction =
    ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction;

export default class CommandHandler {
    list: Collection<string, Command>;

    constructor() {
        this.list = new Collection();
    }

    public async load() {
        const files = await readdir(join(__dirname, "../../../interactions/commands"));

        for (const file of files) {
            const command = (await import(join(__dirname, "../../../interactions/commands", file))).default;
            this.register(new command());
        }
    }

    public register(command: Command) {
        this.list.set(`${command.name}_${command.type}`, command);
    }

    public async publish() {
        const commandData: ApplicationCommandDataResolvable[] = await Promise.all(
            ClientManager.commands.list.map(command => command.build())
        );

        try {
            await ClientManager.client.application?.commands.set(commandData);
            console.log(`Successfully loaded ${ClientManager.commands.list.size} commands!`);
        } catch (err) {
            console.error(err);
        }
    }

    public async handle(interaction: CommandInteraction) {
        const config = ClientManager.config(interaction.guildId as string);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
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

        const channel = interaction.channel as GuildTextBasedChannel;

        const responseType = config.ephemeralResponseIn(channel) ?
            InteractionResponseType.EphemeralDefer :
            command.defer;

        switch (responseType) {
            case InteractionResponseType.Defer: {
                await interaction.deferReply();
                break;
            }

            case InteractionResponseType.EphemeralDefer: {
                await interaction.deferReply({ ephemeral: true });
            }
        }

        try {
            await command.execute(interaction);
        } catch (err) {
            console.log(`Failed to execute command: ${command.name}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(0x2e3136)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`Command \`${command.name}\` used by ${interaction.user}`)
            .setTimestamp();

        const logEmbedFields = [{
            name: "Channel",
            value: `${channel} (\`#${channel.name}\`)`
        }];

        if (interaction.commandType !== ApplicationCommandType.ChatInput) {
            let target = interaction.targetId;
            if (interaction.commandType === ApplicationCommandType.Message) target = interaction.targetMessage.author.id;

            logEmbedFields.push({
                name: "Target",
                value: `<@${target}> (\`${target}\`)`
            });
        }

        log.setFields(logEmbedFields);

        await sendLog({
            event: LoggingEvent.InteractionUsage,
            channel: channel,
            embed: log
        });
    }
}