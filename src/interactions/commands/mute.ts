import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import { InteractionResponseType } from "../../types/interactions";
import { formatReason, formatTimestamp } from "../../utils";
import { muteMember } from "../../utils/moderation";

import ChatInputCommand from "../../handlers/interactions/commands/chatInputCommand";
import Config from "../../utils/config";

export default class MuteCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "mute",
            description: "Temporarily restrict a user's ability to communicate.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
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
                    type: ApplicationCommandOptionType.String
                },
                {
                    name: "reason",
                    description: "The reason for muting the member",
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

        const reason = interaction.options.getString("reason");
        const duration = interaction.options.getString("duration") ?? "28d";
        const res = await muteMember(member, {
            config,
            moderator: interaction.user,
            duration,
            reason
        });

        /* The result is the mute's expiration timestamp */
        if (typeof res === "number") {
            const reply = `muted **${member.user.tag}** until ${formatTimestamp(res, "F")} | Expires ${formatTimestamp(res, "R")}`;
            await Promise.all([
                interaction.reply({
                    content: `${success} Successfully ${reply}${formatReason(reason)}`,
                    ephemeral
                }),
                config.sendConfirmation({
                    guild: interaction.guild!,
                    authorId: interaction.user.id,
                    message: reply,
                    channelId: interaction.channelId,
                    reason
                })
            ]);
            return;
        }

        /* The result is an error message */
        await interaction.reply({
            content: `${error} ${res}`,
            ephemeral
        });
    }
}