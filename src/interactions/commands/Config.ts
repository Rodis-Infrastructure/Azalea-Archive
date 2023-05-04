import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import ClientManager from "../../Client";

import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder
} from "discord.js";

import { InteractionResponseType } from "../../utils/Types";
import { JsonMap, stringify } from "@iarna/toml";

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
                type: ApplicationCommandOptionType.String,
                required: false
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.options.getString("guild_id") ?? interaction.guildId as string;
        const config = ClientManager.config(guildId) as unknown as JsonMap;
        const formattedConfig = stringify(config || {});

        const embed = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setTitle("Guild Configuration")
            .setDescription(`\`\`\`toml\n${formattedConfig}\`\`\``)
            .setFooter({ text: `Guild ID: ${guildId}` })
            .setAuthor({
                name: interaction.guild?.name as string,
                iconURL: interaction.guild?.iconURL() as string
            });

        await interaction.editReply({ embeds: [embed] });
    }
}