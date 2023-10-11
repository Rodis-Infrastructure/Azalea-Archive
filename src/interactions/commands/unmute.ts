import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction, validateModerationAction } from "../../utils/moderation";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { PunishmentType } from "../../types/db";
import { formatReason } from "../../utils";

import Config from "../../utils/config";

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
        const { success, error } = config.emojis;

        if (!target) {
            await interaction.reply({
                content: `${error} The user entered is not a member of the server.`,
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
                content: `${error} ${notModerateableReason}`,
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
        } catch (_err) {
            const err = _err as Error;

            await interaction.reply({
                content: `${error} An error has occurred while trying to unmute this member: ${err.message}`,
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
                content: `${success} Successfully unmuted ${target}${formatReason(reason)}`,
                ephemeral
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: interaction.channelId
            })
        ]);
    }
}