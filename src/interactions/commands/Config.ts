import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder
} from "discord.js";

import { InteractionResponseType } from "../../utils/Types";
import { stringify } from "@iarna/toml";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import ClientManager from "../../Client";

export default class ConfigCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "config",
            description: "View guild configuration.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false,
            options: [{
                name: "guild_id",
                description: "The ID of the guild to view the configuration of",
                type: ApplicationCommandOptionType.String
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.options.getString("guild_id") ?? interaction.guildId!;
        const config = { ...ClientManager.config(guildId) };

        const embed = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setTitle("Guild Configuration")
            .setDescription(`\`\`\`toml\n${stringify(config)}\`\`\``)
            .setFooter({ text: `Guild ID: ${guildId}` })
            .setAuthor({
                name: interaction.guild!.name,
                iconURL: interaction.guild!.iconURL() ?? undefined
            });

        await interaction.editReply({ embeds: [embed] });
    }
}