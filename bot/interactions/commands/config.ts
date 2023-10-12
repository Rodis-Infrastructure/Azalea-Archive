import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    AttachmentBuilder,
    ChatInputCommandInteraction
} from "discord.js";

import { InteractionResponseType } from "@/types/interactions";
import { Command } from "@/handlers/interactions/interaction";

import glob from "fast-glob";

export default class ConfigCommand extends Command {
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

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean): Promise<void> {
        const guildId = interaction.options.getString("guild_id") ?? interaction.guildId;
        const config = glob.sync(`config/${guildId}.{yml,yaml}`).join("\n");

        const file = new AttachmentBuilder(config)
            .setName(`${guildId}.yaml`)
            .setDescription(`Configuration for guild with ID ${guildId}`);

        await interaction.reply({
            content: `Configuration for guild with ID \`${guildId}\``,
            files: [file],
            ephemeral
        });
    }
}