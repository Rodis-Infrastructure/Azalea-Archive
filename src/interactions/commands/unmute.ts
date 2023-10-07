import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import { muteExpirationTimestamp, resolveInfraction, validateModerationAction } from "../../utils/moderation";
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

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const offender = interaction.options.getMember("member") as GuildMember;
        const { success, error } = config.emojis;

        if (!offender) {
            await interaction.reply({
                content: `${error} The user provided is not a member of the server.`,
                ephemeral
            });
            return;
        }

        const notModerateableReason = validateModerationAction({
            config,
            executorId: interaction.user.id,
            target: offender,
            additionalValidation: [{
                condition: !offender.moderatable,
                failResponse: "I do not have permission to unmute this member."
            }]
        });

        if (notModerateableReason) {
            await interaction.reply({
                content: `${error} ${notModerateableReason}`,
                ephemeral
            });
            return;
        }

        if (!muteExpirationTimestamp(offender)) {
            await interaction.reply({
                content: `${error} This member is not muted.`,
                ephemeral
            });
            return;
        }

        const reason = interaction.options.getString("reason");

        try {
            /* Clears the timeout */
            await offender.timeout(null);
            await resolveInfraction({
                guildId: interaction.guildId!,
                punishment: PunishmentType.Unmute,
                targetId: offender.id,
                executor: interaction.user,
                reason
            });
        } catch (err) {
            console.log(err);
            await interaction.reply({
                content: `${error} An error has occurred while trying to unmute this member.`,
                ephemeral
            });
            return;
        }

        await Promise.all([
            interaction.reply({
                content: `${success} Successfully unmuted **${offender.user.tag}**${formatReason(reason)}`,
                ephemeral
            }),
            config.sendActionConfirmation({
                message: `unmuted **${offender.user.tag}**`,
                sourceChannelId: interaction.channelId,
                authorId: interaction.user.id,
                reason
            })
        ]);
    }
}