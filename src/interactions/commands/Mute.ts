import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import { InteractionResponseType } from "../../utils/Types";
import { muteMember } from "../../utils/ModerationUtils";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import Config from "../../utils/Config";
import { formatReason, formatTimestamp } from "../../utils";

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

    async execute(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        const member = interaction.options.getMember("member") as GuildMember;
        const { success, error } = config.emojis;

        if (!member) {
            await interaction.editReply(`${error} The user provided is not a member of the server.`);
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
                interaction.editReply(`${success} Successfully ${reply}${formatReason(reason)}`),
                config.sendInfractionConfirmation({
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
        await interaction.editReply(`${error} ${res}`);
    }
}