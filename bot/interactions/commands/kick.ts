import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction, validateModerationAction } from "@/utils/moderation";
import { InteractionResponseType } from "@/types/interactions";
import { Command } from "@/handlers/interactions/interaction";
import { PunishmentType } from "@database/models/infraction";
import { ensureError, formatReason } from "@/utils";

import Config from "@/utils/config";

export default class KickCommand extends Command {
    constructor() {
        super({
            name: "kick",
            description: "Kick a member from the guild.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "member",
                    description: "The member to kick",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "reason",
                    description: "The reason for kicking the member",
                    type: ApplicationCommandOptionType.String,
                    max_length: 1024
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
            executorId: interaction.user.id,
            target: target,
            additionalValidation: [{
                condition: !target.kickable,
                failResponse: "I do not have permission to kick this member."
            }]
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
            await target.kick(reason);
            await resolveInfraction({
                punishment: PunishmentType.Kick,
                executorId: interaction.user.id,
                targetId: target.id,
                guildId: interaction.guildId,
                reason
            });
        } catch (_error) {
            const error = ensureError(_error);
            await interaction.reply({
                content: `${emojis.error} An error has occurred while trying to execute this interaction: ${error.message}`,
                ephemeral
            });
            return;
        }

        const confirmation = config.formatConfirmation(`kicked ${target}`, {
            executorId: interaction.user.id,
            success: true,
            reason
        });

        await Promise.all([
            interaction.reply({
                content: `${emojis.success} Successfully kicked ${target}${formatReason(reason)}`,
                ephemeral
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: interaction.channelId
            })
        ]);
    }
}