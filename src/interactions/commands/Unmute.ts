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
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false,
            options: [{
                name: "member",
                description: "The member to unmute",
                type: ApplicationCommandOptionType.User,
                required: true
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        const offender = interaction.options.getMember("member") as GuildMember;
        const { success, error } = config.emojis;

        if (!offender) {
            await interaction.editReply(`${error} The user provided is not a member of the server.`);
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
            await interaction.editReply(`${error} ${notModerateableReason}`);
            return;
        }

        if (!muteExpirationTimestamp(offender)) {
            await interaction.editReply(`${error} This member is not muted.`);
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
            await interaction.editReply(`${error} An error has occurred while trying to unmute this member.`);
            return;
        }

        await Promise.all([
            interaction.editReply(`${success} Successfully unmuted **${offender.user.tag}**`),
            config.sendInfractionConfirmation({
                guild: interaction.guild!,
                message: `unmuted **${offender.user.tag}**`,
                channelId: interaction.channelId,
                authorId: interaction.user.id
            })
        ]);
    }
}