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
        const user = interaction.options.getUser("user", true);
        const [member, isBanned] = await Promise.all([
            interaction.guild!.members.fetch(user.id),
            interaction.guild!.bans.fetch(user.id)
        ]).catch(() => []);

        const { success, error } = config.emojis;

        if (member) {
            const notModerateableReason = validateModerationAction({
                config,
                executorId: interaction.user.id,
                target: member,
                additionalValidation: [{
                    condition: !member.bannable,
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
            await interaction.guild!.members.ban(user, {
                deleteMessageSeconds: config.deleteMessageSecondsOnBan,
                reason
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: `${error} An error has occurred while trying to ban this user.`,
                ephemeral
            });
            return;
        }

        await Promise.all([
            interaction.reply({
                content: `${success} Successfully banned **${user.tag}**${formatReason(reason)}`,
                ephemeral
            }),
            config.sendActionConfirmation({
                authorId: interaction.user.id,
                message: `banned **${user.tag}**`,
                sourceChannelId: interaction.channelId,
                reason
            }),
            resolveInfraction({
                punishment: PunishmentType.Ban,
                executor: interaction.user,
                targetId: user.id,
                guildId: interaction.guildId!,
                reason
            })
        ]);
    }
}