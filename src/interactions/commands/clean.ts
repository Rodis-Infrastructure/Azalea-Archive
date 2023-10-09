import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember,
    GuildTextBasedChannel
} from "discord.js";

import { purgeMessages, validateModerationAction } from "../../utils/moderation";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { pluralize } from "../../utils";

import Config from "../../utils/config";

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

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const amount = interaction.options.getInteger("amount") ?? 100;
        const targetUser = interaction.options.getUser("user");
        const targetMember = interaction.options.getMember("user") as GuildMember | null;

        const { success, error } = config.emojis;

        if (targetMember) {
            const notModerateableReason = validateModerationAction({
                config,
                executorId: interaction.user.id,
                target: targetMember
            });

            if (notModerateableReason) {
                await interaction.reply({
                    content: `${error} ${notModerateableReason}`,
                    ephemeral
                });
                return;
            }
        }

        try {
            const purgedMessageCount = await purgeMessages({
                channel: interaction.channel as GuildTextBasedChannel,
                executorId: interaction.user.id,
                targetId: targetUser?.id,
                amount
            });

            if (!purgedMessageCount) {
                await interaction.reply({
                    content: `${error} There are no messages to purge.`,
                    ephemeral
                });
                return;
            }

            await interaction.reply({
                content: `${success} Successfully purged \`${purgedMessageCount}\` ${pluralize("message", purgedMessageCount)}.`,
                ephemeral
            });
        } catch (_err) {
            const err = _err as Error;

            await interaction.reply({
                content: `${error} Failed to purge messages: ${err.message}`,
                ephemeral
            });
        }
    }
}