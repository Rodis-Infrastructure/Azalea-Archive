import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import { resolveInfraction, validateModerationAction } from "../../utils/ModerationUtils";
import { InfractionType, InteractionResponseType } from "../../utils/Types";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import Config from "../../utils/Config";
import { formatReason } from "../../utils";

export default class KickCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "kick",
            description: "Kick a member from the guild.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
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
                    max_length: 1024
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const member = interaction.options.getMember("member") as GuildMember;
        const { success, error } = config.emojis;

        if (!member) {
            await interaction.reply({
                content: `${error} The user provided is not a member of the server.`,
                ephemeral
            });
            return;
        }

        const notModerateableReason = validateModerationAction({
            config,
            moderatorId: interaction.user.id,
            offender: member,
            additionalValidation: [{
                condition: !member.kickable,
                reason: "I do not have permission to kick this member."
            }]
        });

        if (notModerateableReason) {
            await interaction.reply({
                content: `${error} ${notModerateableReason}`,
                ephemeral
            });
            return;
        }

        const reason = interaction.options.getString("reason") ?? undefined;

        try {
            await member.kick(reason);
            await resolveInfraction({
                infractionType: InfractionType.Kick,
                moderator: interaction.user,
                offender: member.user,
                guildId: interaction.guildId!,
                reason
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: `${error} An error has occurred while trying to execute this interaction.`,
                ephemeral
            });
            return;
        }

        await Promise.all([
            interaction.reply({
                content: `${success} Successfully kicked **${member.user.tag}**${formatReason(reason)}`,
                ephemeral
            }),
            config.sendInfractionConfirmation({
                guild: interaction.guild!,
                authorId: interaction.user.id,
                message: `kicked **${member.user.tag}**`,
                channelId: interaction.channelId,
                reason
            })
        ]);
    }
}