import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";

import ClientManager from "../../Client";
import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import { resolveInfraction, validateModerationReason } from "../../utils/ModerationUtils";
import { InfractionType, InteractionResponseType } from "../../utils/Types";

export default class BanCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "ban",
            description: "Ban a user from the guild.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
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
        const user = interaction.options.getUser("user")!;
        const guildId = interaction.guildId!;
        const config = ClientManager.config(guildId)!;

        const { success, error } = config.emojis;
        const member = await interaction.guild?.members.fetch(user.id)
            .catch(() => undefined);

        if (member) {
            const notModerateableReason = validateModerationReason({
                config,
                moderatorId: interaction.user.id,
                offender: member,
                additionalValidation: [{
                    condition: !member.bannable,
                    reason: "I do not have permission to ban this member."
                }]
            });

            if (notModerateableReason) {
                await interaction.editReply(`${error} ${notModerateableReason}`);
                return;
            }
        }

        try {
            await interaction.guild?.members.ban(user, {
                reason: reason ?? undefined,
                deleteMessageSeconds: config.deleteMessageSecondsOnBan
            });

            await resolveInfraction({
                infractionType: InfractionType.Ban,
                moderator: interaction.user,
                offender: user,
                guildId,
                reason
            });

            await interaction.editReply(`${success} Successfully banned **${user.tag}**${reason ? ` (\`${reason}\`)` : ""}`);
        } catch {
            await interaction.editReply(`${error} An error has occurred while trying to ban this user.`);
        }
    }
}