import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import ClientManager from "../../Client";
import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import { InfractionType, InteractionResponseType } from "../../utils/Types";
import ms from "ms";
import { resolveInfraction } from "../../utils/ModerationUtils";

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

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const member = interaction.options.getMember("member") as GuildMember;
        const guildId = interaction.guildId!;
        const config = ClientManager.config(guildId)!;

        const { success, error } = config.emojis;

        if (!member) {
            await interaction.editReply(`${error} The user provided is not a member of the server.`);
            return;
        }

        const notModerateableReason = config.validateModerationReason({
            moderatorId: interaction.user.id,
            offender: member,
            additionalValidation: [{
                condition: !member.moderatable,
                reason: "I do not have permission to unmute this member."
            }]
        });

        if (notModerateableReason) {
            await interaction.editReply(`${error} ${notModerateableReason}`);
            return;
        }

        const currentTimestamp = ms(Date.now().toString());
        const mutedTimestamp = member.communicationDisabledUntilTimestamp;

        if (!mutedTimestamp || mutedTimestamp < currentTimestamp) {
            await interaction.editReply(`${error} This member is not muted.`);
            return;
        }

        try {
            await member.timeout(null);
            await resolveInfraction({
                guildId,
                infractionType: InfractionType.Unmute,
                offender: member.user,
                moderator: interaction.user
            });

            await interaction.editReply(`${success} Successfully unmuted **${member.user.tag}**`);
        } catch {
            await interaction.editReply(`${error} An error has occurred while trying to unmute this member.`);
        }
    }
}