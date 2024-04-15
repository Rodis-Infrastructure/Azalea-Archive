import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    AttachmentBuilder,
    ChatInputCommandInteraction
} from "discord.js";

import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";

import glob from "fast-glob";

export default class ConfigCommand extends Command {
    constructor() {
        super({
            name: "config",
            description: "View guild configuration.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipEphemeralCheck: false,
            options: [{
                name: "guild_id",
                description: "The ID of the guild to view the configuration of",
                type: ApplicationCommandOptionType.Number
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean): Promise<void> {
        const guildId = interaction.options.getNumber("guild_id") ?? interaction.guildId;
        const [filename] = await glob.glob(`config/${guildId}.{yaml,yml}`).catch(() => [null]);

        if (!filename) {
            await interaction.reply({
                content: `Configuration for guild with ID \`${guildId}\` does not exist.`,
                ephemeral
            });
            return;
        }

        const file = new AttachmentBuilder(filename)
            .setName(filename)
            .setDescription(`Configuration for guild with ID ${guildId}`);

        await interaction.reply({
            content: `Configuration for guild with ID \`${guildId}\``,
            files: [file],
            ephemeral
        });
    }
}