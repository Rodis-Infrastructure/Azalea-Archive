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
        this.list.set(`${command.data.name}_${command.data.type}`, command);
    }

    public async publish() {
        const commandData = ClientManager.commands.list.map(command => command.build());

        try {
            await ClientManager.client.application?.commands.set(commandData);
            console.log(`Successfully loaded ${ClientManager.commands.list.size} commands!`);
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

        const command = this.list.get(`${interaction.commandName}_${interaction.commandType}`);

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
            channel: usageChannel,
            options: {
                embeds: [log],
                files: [{
                    attachment: "./icons/interaction.png",
                    name: "interaction.png"
                }]
            }
        });
    }
}