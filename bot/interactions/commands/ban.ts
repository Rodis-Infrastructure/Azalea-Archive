import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction, validateModerationAction } from "@/utils/moderation";
import { PunishmentType } from "@database/models/infraction";
import { InteractionResponseType } from "@/types/interactions";
import { Command } from "@/handlers/interactions/interaction";
import { ensureError, formatReason } from "@/utils";

import Config from "@/utils/config";

export default class BanCommand extends Command {
    constructor() {
        super({
            name: "ban",
            description: "Ban a user from the guild.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "user",
                    description: "The user to ban",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "reason",
                    description: "The reason for banning the user",
                    type: ApplicationCommandOptionType.String,
                    max_length: 1024
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const targetUser = interaction.options.getUser("user", true);
        const targetMember = interaction.options.getMember("user");

        const isBanned = await interaction.guild.bans.fetch(targetUser.id)
            .then(() => true)
            .catch(() => false);

        const { emojis } = config;

        if (targetMember) {
            const notModerateableReason = validateModerationAction({
                config,
                executorId: interaction.user.id,
                target: targetMember,
                additionalValidation: [{
                    condition: !targetMember.bannable,
                    failResponse: "I do not have permission to ban this member."
                }]
            });

            if (notModerateableReason) {
                await interaction.reply({
                    content: `${emojis.error} ${notModerateableReason}`,
                    ephemeral
                });
                return;
            }
        }

        if (isBanned) {
            await interaction.reply({
                content: `${emojis.error} This user has already been banned.`,
                ephemeral
            });
            return;
        }

        const reason = interaction.options.getString("reason") ?? undefined;

        try {
            await interaction.guild.members.ban(targetUser, {
                deleteMessageSeconds: config.deleteMessageSecondsOnBan,
                reason
            });
        } catch (_error) {
            const error = ensureError(_error);
            await interaction.reply({
                content: `${emojis.error} ${error.message}`,
                ephemeral
            });

            return;
        }

        const confirmation = config.formatConfirmation(`banned ${targetUser}`, {
            executorId: interaction.user.id,
            success: true,
            reason
        });

        await Promise.all([
            interaction.reply({
                content: `${emojis.success} Successfully banned ${targetUser}${formatReason(reason)}`,
                ephemeral
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: interaction.channelId
            }),
            resolveInfraction({
                punishment: PunishmentType.Ban,
                executorId: interaction.user.id,
                targetId: targetUser.id,
                guildId: interaction.guildId,
                reason
            })
        ]);
    }
}