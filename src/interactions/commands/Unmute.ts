import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import { InfractionType, InteractionResponseType } from "../../utils/Types";
import { muteExpirationTimestamp, resolveInfraction, validateModerationAction } from "../../utils/ModerationUtils";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import Config from "../../utils/Config";

export default class UnmuteCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "unmute",
            description: "Revoke a user's timeout.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [{
                name: "member",
                description: "The member to unmute",
                type: ApplicationCommandOptionType.User,
                required: true
            }]
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
            moderatorId: interaction.user.id,
            offender,
            additionalValidation: [{
                condition: !offender.moderatable,
                reason: "I do not have permission to unmute this member."
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

        try {
            /* Clears the timeout */
            await offender.timeout(null);
            await resolveInfraction({
                guildId: interaction.guildId!,
                infractionType: InfractionType.Unmute,
                offender: offender.user,
                moderator: interaction.user
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
                content: `${success} Successfully unmuted **${offender.user.tag}**`,
                ephemeral
            }),
            config.sendConfirmation({
                guild: interaction.guild!,
                message: `unmuted **${offender.user.tag}**`,
                channelId: interaction.channelId,
                authorId: interaction.user.id
            })
        ]);
    }
}