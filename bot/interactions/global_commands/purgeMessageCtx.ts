import { ApplicationCommandType, MessageContextMenuCommandInteraction } from "discord.js";
import { purgeMessages, validateModerationAction } from "@bot/utils/moderation";
import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { ensureError } from "@bot/utils";

import Config from "@bot/utils/config";

export default class PurgeMessageCtxCommand extends Command {
    constructor() {
        super({
            name: "Purge messages",
            type: ApplicationCommandType.Message,
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction<"cached">, _ephemeral: never, config: Config): Promise<void> {
        if (!interaction.channel) return;

        const { emojis } = config;

        const targetUser = interaction.targetMessage.author;
        const targetMember = interaction.targetMessage.member;

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
            const purgedMessageCount = await purgeMessages({
                channel: interaction.channel,
                amount: 100,
                targetId: targetUser.id,
                executorId: interaction.user.id
            });

            if (!purgedMessageCount) {
                await interaction.editReply(`${emojis.error} There are no messages to purge.`);
                return;
            }

            await interaction.editReply(`${emojis.success} Successfully purged \`${purgedMessageCount}\` messages by ${targetUser}.`);
        } catch (_error) {
            const error = ensureError(_error);
            await interaction.editReply(`${emojis.error} Failed to purge messages: ${error.message}`);
        }
    }
}