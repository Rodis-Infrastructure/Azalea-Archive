import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction, validateModerationAction } from "@bot/utils/moderation";
import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { PunishmentType } from "@database/models/infraction";
import { ensureError, formatReason } from "@bot/utils";

import Config from "@bot/utils/config";

export default class UnmuteCommand extends Command {
    constructor() {
        super({
            name: "unmute",
            description: "Revoke a user's timeout.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "member",
                    description: "The member to unmute",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "reason",
                    description: "The reason for unmuting this member",
                    type: ApplicationCommandOptionType.String
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const target = interaction.options.getMember("member");
        const { emojis } = config;

        if (!target) {
            await interaction.reply({
                content: `${emojis.error} The user entered is not a member of the server.`,
                ephemeral
            });
            return;
        }

        const notModerateableReason = validateModerationAction({
            config,
            target,
            executorId: interaction.user.id,
            additionalValidation: [
                {
                    condition: !target.moderatable,
                    failResponse: "I do not have permission to unmute this member."
                },
                {
                    condition: !target.isCommunicationDisabled(),
                    failResponse: "This member is not muted."
                }
            ]
        });

        if (notModerateableReason) {
            await interaction.reply({
                content: `${emojis.error} ${notModerateableReason}`,
                ephemeral
            });
            return;
        }

        const reason = interaction.options.getString("reason") ?? undefined;

        try {
            // Clears the timeout
            await target.timeout(null);
            await resolveInfraction({
                guildId: interaction.guildId,
                punishment: PunishmentType.Unmute,
                targetId: target.id,
                executorId: interaction.user.id,
                reason
            });
        } catch (_error) {
            const error = ensureError(_error);
            await interaction.reply({
                content: `${emojis.error} An error has occurred while trying to unmute this member: ${error.message}`,
                ephemeral
            });

            return;
        }

        const confirmation = config.formatConfirmation(`unmuted ${target}`, {
            executorId: interaction.user.id,
            success: true,
            reason
        });

        await Promise.all([
            interaction.reply({
                content: `${emojis.success} Successfully unmuted ${target}${formatReason(reason)}`,
                ephemeral
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: interaction.channelId
            })
        ]);
    }
}