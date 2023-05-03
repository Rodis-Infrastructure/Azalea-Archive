import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import ClientManager from "../../Client";
import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import { resolveInfraction, validateModerationReason } from "../../utils/ModerationUtils";
import { InfractionType, InteractionResponseType } from "../../utils/Types";

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
        const guildId = interaction.guildId!;
        const config = ClientManager.config(guildId)!;

        const { success, error } = config.emojis;

        if (!member) {
            await interaction.editReply(`${error} The user provided is not a member of the server.`);
            return;
        }

        const notModerateableReason = validateModerationReason({
            config,
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
            await Promise.all([
                resolveInfraction({
                    infractionType: InfractionType.Kick,
                    moderator: interaction.user,
                    offender: member.user,
                    guildId,
                    reason
                }),

                interaction.editReply(`${success} Successfully kicked **${member.user.tag}**${reason ? ` (\`${reason}\`)` : ""}`)
            ]);
        } catch {
            await interaction.editReply(`${error} An error has occurred while trying to kick this member.`);
        }
    }
}