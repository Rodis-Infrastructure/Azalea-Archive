import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import ClientManager from "../../../Client";
import ChatInputCommand from "../../../handlers/interactions/commands/ChatInputCommand";
import { resolveMemberKick } from "../../../utils/ModerationUtils";
import { InteractionResponseType } from "../../../utils/Types";

export default class KickCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "kick",
            description: "Kick a member from the guild.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
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
        const member = interaction.options.getMember("member") as GuildMember;
        const guildId = interaction.guildId as string;
        const config = ClientManager.config(guildId);

        const { success, error } = config!.emojis;

        const notModerateableReason = config?.validateModerationReason({
            moderatorId: interaction.user.id,
            offender: member,
            additionalValidation: [{
                condition: !member.kickable,
                reason: "I do not have permission to kick this member."
            }]
        });

        if (notModerateableReason) {
            await interaction.editReply(`${error} ${notModerateableReason}`);
            return;
        }

        try {
            await member.kick(reason ?? undefined);
            await resolveMemberKick({
                moderator: interaction.user,
                offender: member.user,
                guildId,
                reason
            });

            await interaction.editReply(`${success} Successfully kicked **${member.user.tag}**${reason ? ` (\`${reason}\`)` : ""}`);
        } catch {
            await interaction.editReply(`${error} An error occurred while trying to kick this member.`);
        }
    }
}
