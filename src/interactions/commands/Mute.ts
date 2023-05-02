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

export default class MuteCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "mute",
            description: "Temporarily restrict a user's ability to communicate.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "member",
                    description: "The member to mute",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "duration",
                    description: "The duration of the mute",
                    type: ApplicationCommandOptionType.String,
                    required: false
                },
                {
                    name: "reason",
                    description: "The reason for muting the member",
                    type: ApplicationCommandOptionType.String,
                    max_length: 1024,
                    required: false
                }
            ]
        });
    }

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const reason = interaction.options.getString("reason");
        const duration = interaction.options.getString("duration") ?? "28d";
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
                reason: "I do not have permission to mute this member."
            }]
        });

        if (notModerateableReason) {
            await interaction.editReply(`${error} ${notModerateableReason}`);
            return;
        }

        const currentTimestamp = ms(Date.now().toString());
        let mutedTimestamp = member.communicationDisabledUntilTimestamp;

        if (mutedTimestamp && mutedTimestamp >= currentTimestamp) {
            mutedTimestamp = Math.round(mutedTimestamp / 1000);
            await interaction.editReply(`${error} This member has already been muted until <t:${mutedTimestamp}:F> (expires <t:${mutedTimestamp}:R>).`);
            return;
        }

        let msDuration = ms(duration);

        if (!duration.match(/^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi) || msDuration <= 0) {
            await interaction.editReply(`${error} The duration provided is not valid.`);
            return;
        }

        if (msDuration > ms("28d")) msDuration = ms("28d");

        try {
            await member.timeout(msDuration, reason ?? undefined);
            await resolveInfraction({
                guildId,
                infractionType: InfractionType.Mute,
                offender: member.user,
                moderator: interaction.user,
                duration: msDuration,
                reason
            });

            msDuration += currentTimestamp;
            msDuration = Math.round(msDuration / 1000);

            await interaction.editReply(`${success} Successfully muted **${member.user.tag}** until <t:${msDuration}:F> | Expires <t:${msDuration}:R>${reason ? ` (\`${reason}\`)` : ""}`);
        } catch {
            await interaction.editReply(`${error} An error has occurred while trying to mute this member.`);
        }
    }
}