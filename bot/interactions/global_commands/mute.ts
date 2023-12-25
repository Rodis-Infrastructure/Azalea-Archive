import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { ensureError, formatMuteExpirationResponse, formatReason, MAX_MUTE_DURATION } from "@bot/utils";
import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { muteMember } from "@bot/utils/moderation";

import Config from "@bot/utils/config";
import ms from "ms";

export default class MuteCommand extends Command {
    constructor() {
        super({
            name: "mute",
            description: "Temporarily restrict a user's ability to communicate.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipEphemeralCheck: false,
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
        const { emojis } = config;

        if (!target) {
            await interaction.reply({
                content: `${emojis.error} The user entered is not a member of the server.`,
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
                    content: `${emojis.success} Successfully ${response}${formatReason(reason)}`,
                    ephemeral
                }),
                config.sendNotification(confirmation, {
                    sourceChannelId: interaction.channelId
                })
            ]);
        } catch (_error) {
            const error = ensureError(_error);
            await interaction.reply({
                content: `${emojis.error} ${error.message}`,
                ephemeral
            });
        }
    }
}