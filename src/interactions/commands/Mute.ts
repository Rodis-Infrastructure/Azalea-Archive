import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import ClientManager from "../../Client";
import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import { InteractionResponseType } from "../../utils/Types";
import { muteMember } from "../../utils/ModerationUtils";

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

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const reason = interaction.options.getString("reason") ?? undefined;
        const duration = interaction.options.getString("duration") ?? "28d";
        const member = interaction.options.getMember("member") as GuildMember;
        const guildId = interaction.guildId!;
        const config = ClientManager.config(guildId)!;

        const { success, error } = config.emojis;

        if (!member) {
            await interaction.editReply(`${error} The user provided is not a member of the server.`);
            return;
        }

        const res = await muteMember({
            config,
            moderator: interaction.user,
            offender: member,
            duration,
            reason
        });

        if (typeof res === "number") {
            await interaction.editReply(`${success} Successfully muted **${member.user.tag}** until <t:${res}:F> | Expires <t:${res}:R>${reason ? ` (\`${reason}\`)` : ""}`);
            return;
        }

        await interaction.editReply(`${error} ${res}`);
    }
}