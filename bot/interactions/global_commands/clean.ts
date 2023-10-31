import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { purgeMessages, validateModerationAction } from "@bot/utils/moderation";
import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { ensureError, pluralize } from "@bot/utils";

import Config from "@bot/utils/config";

export default class CleanCommand extends Command {
    constructor() {
        super({
            name: "clean",
            description: "Purge messages in the channel.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "all",
                    description: "Purge all messages in the channel.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{
                        name: "amount",
                        description: "The amount of messages to purge.",
                        type: ApplicationCommandOptionType.Integer,
                        max_value: 100,
                        min_value: 1,
                        required: true
                    }]
                },
                {
                    name: "user",
                    description: "Purge messages from a user in the channel.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "user",
                            description: "The amount of messages to purge.",
                            type: ApplicationCommandOptionType.User,
                            required: true
                        },
                        {
                            name: "amount",
                            description: "The amount of messages to purge.",
                            type: ApplicationCommandOptionType.Integer,
                            max_value: 100,
                            min_value: 1
                        }
                    ]
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        if (!interaction.channel || !interaction.channel.isTextBased()) return;

        const amount = interaction.options.getInteger("amount") ?? 100;
        const targetUser = interaction.options.getUser("user");
        const targetMember = interaction.options.getMember("user");

        const { emojis } = config;

        if (targetMember) {
            const notModerateableReason = validateModerationAction({
                config,
                executorId: interaction.user.id,
                target: targetMember
            });

            if (notModerateableReason) {
                await interaction.reply({
                    content: `${emojis.error} ${notModerateableReason}`,
                    ephemeral
                });
                return;
            }
        }

        try {
            const purgedMessageCount = await purgeMessages({
                channel: interaction.channel,
                executorId: interaction.user.id,
                targetId: targetUser?.id,
                amount
            });

            if (!purgedMessageCount) {
                await interaction.reply({
                    content: `${emojis.error} There are no messages to purge.`,
                    ephemeral
                });
                return;
            }

            await interaction.reply({
                content: `${emojis.success} Successfully purged \`${purgedMessageCount}\` ${pluralize("message", purgedMessageCount)}.`,
                ephemeral
            });
        } catch (_error) {
            const err = ensureError(_error);
            await interaction.reply({
                content: `${emojis.error} ${err.message}`,
                ephemeral
            });
        }
    }
}