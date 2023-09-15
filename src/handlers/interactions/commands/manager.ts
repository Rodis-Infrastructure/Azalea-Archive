import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    Collection,
    Colors,
    EmbedBuilder,
    GuildTextBasedChannel
} from "discord.js";

import { Command, CommandInteraction } from "../../../types/interactions";
import { sendLog } from "../../../utils/logging";
import { LoggingEvent } from "../../../types/config";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import ClientManager from "../../../client";
import Config from "../../../utils/config";

export default class CommandHandler {
    global: Collection<string, Command>;
    guild: Collection<string, Command>;

    constructor() {
        this.global = new Collection();
        this.guild = new Collection();
    }

    public async loadGlobalCommands() {
        const files = await readdir(join(__dirname, "../../../interactions/commands"));

        for (const file of files) {
            const command = (await import(join(__dirname, "../../../interactions/commands", file))).default;
            this.registerGlobalCommand(new command());
        }
    }

    public async loadGuildCommands(config: Config) {
        const files = await readdir(join(__dirname, "../../../interactions/guild_commands"));

        for (const file of files) {
            const command = (await import(join(__dirname, "../../../interactions/guild_commands", file))).default;
            this.registerGuildCommand(config.guildId, new command(config));
        }
    }

    public async publishGlobalCommands() {
        const commandData = ClientManager.commands.global.map(command => command.build());

        try {
            await ClientManager.client.application?.commands.set(commandData);
            console.log(`Successfully loaded ${ClientManager.commands.global.size} commands!`);
        } catch (err) {
            console.error(err);
        }
    }

    public async publishGuildCommands(config: Config) {
        const commandData = ClientManager.commands.guild
            .filter((_, name) => name.includes(config.guildId))
            .map(command => command.build());

        try {
            const guild = await ClientManager.client.guilds.fetch(config.guildId).catch(() => null);
            if (!guild) return;

            await guild.commands.set(commandData);
            console.log(`Successfully loaded ${commandData.length} guild commands! (${guild.id})`);
        } catch (err) {
            console.error(err);
        }
    }

    public async handle(interaction: CommandInteraction) {
        const config = ClientManager.config(interaction.guildId!);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const command = this.global.get(`${interaction.commandName}_${interaction.commandType}`)
            || this.guild.get(`${interaction.commandName}_${interaction.commandType}_${interaction.guildId}`);

        if (!command) {
            await interaction.reply({
                content: "Interaction not found.",
                ephemeral: true
            });
            return;
        }

        const usageChannel = interaction.channel as GuildTextBasedChannel;
        const ephemeral = await config.applyDeferralState({
            interaction,
            state: command.data.defer,
            skipInternalUsageCheck: command.data.skipInternalUsageCheck,
            ephemeral: command.data.ephemeral
        });

        let subcommand = "";

        if (
            interaction.isChatInputCommand() &&
            interaction.options.data.some(option => option.type === ApplicationCommandOptionType.Subcommand)
        ) {
            subcommand = ` ${interaction.options.getSubcommand()}`;
        }

        try {
            await command.execute(interaction, ephemeral, config);
        } catch (err) {
            console.log(`Failed to execute command: ${command.data.name}${subcommand}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({ name: "Interaction Used", iconURL: "attachment://interaction.png" })
            .setDescription(`Command \`${command.data.name}${subcommand}\` used by ${interaction.user}`)
            .setFields([{
                name: "Channel",
                value: `${usageChannel} (\`#${usageChannel.name}\`)`
            }])
            .setTimestamp();

        if (interaction.commandType !== ApplicationCommandType.ChatInput) {
            let targetUserId = interaction.targetId;
            if (interaction.commandType === ApplicationCommandType.Message) targetUserId = interaction.targetMessage.author.id;

            log.addFields([{
                name: "Target",
                value: `<@${targetUserId}> (\`${targetUserId}\`)`
            }]);
        }

        await sendLog({
            event: LoggingEvent.Interaction,
            categoryId: usageChannel.parentId,
            channelId: usageChannel.id,
            guildId: interaction.guildId!,
            options: {
                embeds: [log],
                files: [{
                    attachment: "./icons/interaction.png",
                    name: "interaction.png"
                }]
            }
        });
    }

    private registerGlobalCommand(command: Command) {
        this.global.set(`${command.data.name}_${command.data.type}`, command);
    }

    private registerGuildCommand(guildId: string, command: Command) {
        this.guild.set(`${command.data.name}_${command.data.type}_${guildId}`, command);
    }
}