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
            defer: InteractionResponseType.Defer,
            skipEphemeralCheck: false,
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

    async execute(interaction: ChatInputCommandInteraction<"cached">, _ephemeral: never, config: Config): Promise<void> {
        if (!interaction.channel) {
            await interaction.editReply("Failed to fetch channel.");
            return;
        }

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
                await interaction.editReply(`${emojis.error} ${notModerateableReason}`);
                return;
            }
        }

        try {
            const purgedMessages = await purgeMessages({
                channel: interaction.channel,
                executorId: interaction.user.id,
                targetId: targetUser?.id,
                amount
            });

            if (!purgedMessages.length) {
                await interaction.editReply(`${emojis.error} There are no messages to purge.`);
                return;
            }

            await interaction.editReply(`${emojis.success} Successfully purged \`${purgedMessages.length}\` ${pluralize("message", purgedMessages.length)}.`);
        } catch (_error) {
            const err = ensureError(_error);
            await interaction.editReply(`${emojis.error} ${err.message}`);
        }
    }
}