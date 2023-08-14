import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    codeBlock,
    Colors,
    EmbedBuilder
} from "discord.js";

import { InteractionResponseType } from "../../types/interactions";
import { JsonMap, stringify } from "@iarna/toml";

import ChatInputCommand from "../../handlers/interactions/commands/chatInputCommand";
import ClientManager from "../../client";

export default class ConfigCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "config",
            description: "View guild configuration.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [{
                name: "guild_id",
                description: "The ID of the guild to view the configuration of",
                type: ApplicationCommandOptionType.String
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean): Promise<void> {
        const guildId = interaction.options.getString("guild_id") ?? interaction.guildId!;
        const config = { ...(ClientManager.config(guildId)?.data) } as unknown as JsonMap;

        const embed = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setTitle("Guild Configuration")
            .setDescription(codeBlock("toml", stringify(config)))
            .setFooter({ text: `Guild ID: ${guildId}` })
            .setAuthor({
                name: interaction.guild!.name,
                iconURL: interaction.guild!.iconURL() ?? undefined
            });

        await interaction.reply({
            embeds: [embed],
            ephemeral
        });
    }
}