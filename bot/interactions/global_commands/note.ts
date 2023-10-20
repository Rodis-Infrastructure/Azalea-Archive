import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction, validateModerationAction } from "@bot/utils/moderation";
import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { PunishmentType } from "@database/models/infraction";
import { ensureError, formatReason } from "@bot/utils";

import Config from "@bot/utils/config";

export default class NoteCommand extends Command {
    constructor() {
        super({
            name: "note",
            description: "Add a note to a member's infraction history.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "user",
                    description: "The user to add a note to",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "note",
                    description: "The note to add",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    max_length: 1024
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const targetMember = interaction.options.getMember("user");
        const targetUser = interaction.options.getUser("user", true);
        const note = interaction.options.getString("note", true);

        const { emojis } = config;

        if (targetMember) {
            const notModerateableReason = validateModerationAction({
                executorId: interaction.user.id,
                target: targetMember,
                config
            });

            if (notModerateableReason) {
                await interaction.reply({
                    content: `${emojis.error} ${notModerateableReason}`,
                    ephemeral
                });
                return;
            }
        }

        try {
            await resolveInfraction({
                executorId: interaction.user.id,
                targetId: targetUser.id,
                guildId: interaction.guildId,
                reason: note,
                punishment: PunishmentType.Note
            });
        } catch (_error) {
            const error = ensureError(_error);
            await interaction.reply({
                content: `${emojis.error} An error occurred while trying to execute this interaction: ${error.message}`,
                ephemeral
            });

            return;
        }

        const confirmation = config.formatConfirmation(`added a note to ${targetUser}`, {
            executorId: interaction.user.id,
            success: true,
            reason: note
        });

        await Promise.all([
            interaction.reply({
                content: `${emojis.success} Successfully added a note to ${targetUser}${formatReason(note)}`,
                ephemeral
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: interaction.channelId
            })
        ]);
    }
}