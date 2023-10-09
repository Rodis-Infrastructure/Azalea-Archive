import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction, validateModerationAction } from "../../utils/moderation";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { PunishmentType } from "../../types/db";
import { formatReason } from "../../utils";

import Config from "../../utils/config";

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

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const targetUser = interaction.options.getUser("user", true);

        const [targetMember, isBanned] = await Promise.all([
            interaction.guild!.members.fetch(targetUser.id),
            interaction.guild!.bans.fetch(targetUser.id)
        ]).catch(() => []);

        const { success, error } = config.emojis;

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
                    content: `${error} ${notModerateableReason}`,
                    ephemeral
                });
                return;
            }
        }

        if (isBanned) {
            await interaction.reply({
                content: `${error} This user has already been banned.`,
                ephemeral
            });
            return;
        }

        const reason = interaction.options.getString("reason") ?? undefined;

        try {
            await interaction.guild!.members.ban(targetUser, {
                deleteMessageSeconds: config.deleteMessageSecondsOnBan,
                reason
            });
        } catch (_err) {
            const err = _err as Error;

            await interaction.reply({
                content: `${error} An error has occurred while trying to ban this user: ${err.message}`,
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
                content: `${success} Successfully banned ${targetUser}${formatReason(reason)}`,
                ephemeral
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: interaction.channelId
            }),
            resolveInfraction({
                punishment: PunishmentType.Ban,
                executorId: interaction.user.id,
                targetId: targetUser.id,
                guildId: interaction.guildId!,
                reason
            })
        ]);
    }
}