import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { InteractionResponseType } from "@/types/interactions";
import { Command } from "@/handlers/interactions/interaction";
import { formatMuteExpirationResponse, formatReason, MAX_MUTE_DURATION } from "@/utils";
import { muteMember } from "@/utils/moderation";

import Config from "@/utils/config";
import ms from "ms";

export default class MuteCommand extends Command {
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

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const target = interaction.options.getMember("member");
        const { success, error } = config.emojis;

        if (!target) {
            await interaction.reply({
                content: `${error} The user entered is not a member of the server.`,
                ephemeral
            });
            return;
        }

        const reason = interaction.options.getString("reason") ?? undefined;
        const duration = interaction.options.getString("duration") ?? ms(MAX_MUTE_DURATION);

        try {
            const { expiresAt } = await muteMember(target, {
                executorId: interaction.user.id,
                duration,
                config,
                reason
            });

            const response = `muted ${target} until ${formatMuteExpirationResponse(expiresAt)}`;
            const confirmation = config.formatConfirmation(response, {
                executorId: interaction.user.id,
                success: true,
                reason
            });

            await Promise.all([
                interaction.reply({
                    content: `${success} Successfully ${response}${formatReason(reason)}`,
                    ephemeral
                }),
                config.sendNotification(confirmation, {
                    sourceChannelId: interaction.channelId
                })
            ]);
            return;
        } catch (_err) {
            const err = _err as Error;

            await interaction.reply({
                content: `${error} ${err.message}`,
                ephemeral
            });
        }
    }
}