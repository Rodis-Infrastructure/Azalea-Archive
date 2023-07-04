import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction, validateModerationAction } from "../../utils/moderationUtils";
import { InteractionResponseType } from "../interaction.types";
import { InfractionType } from "../../utils/utils.types";
import { formatReason } from "../../utils";

import ChatInputCommand from "../../handlers/interactions/commands/chatInputCommand";
import Config from "../../utils/config";

export default class BanCommand extends ChatInputCommand {
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
                moderatorId: interaction.user.id,
                offender: member,
                additionalValidation: [{
                    condition: !member.bannable,
                    reason: "I do not have permission to ban this member."
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

        let deleteMessageSeconds = config.deleteMessageSecondsOnBan;

        /* Minimum value */
        if (deleteMessageSeconds < 0) deleteMessageSeconds = 0;
        /* Maximum value */
        if (deleteMessageSeconds > 604800) deleteMessageSeconds = 604800;

        const reason = interaction.options.getString("reason") ?? undefined;

        try {
            await interaction.guild!.members.ban(user, { deleteMessageSeconds, reason });
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
            config.sendConfirmation({
                guild: interaction.guild!,
                authorId: interaction.user.id,
                message: `banned **${user.tag}**`,
                channelId: interaction.channelId,
                reason
            }),
            resolveInfraction({
                infractionType: InfractionType.Ban,
                moderator: interaction.user,
                offender: user,
                guildId: interaction.guildId!,
                reason
            })
        ]);
    }
}