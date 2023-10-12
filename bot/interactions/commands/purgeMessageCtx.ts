import { ApplicationCommandType, MessageContextMenuCommandInteraction } from "discord.js";
import { purgeMessages, validateModerationAction } from "@/utils/moderation";
import { InteractionResponseType } from "@/types/interactions";
import { Command } from "@/handlers/interactions/interaction";

import Config from "@/utils/config";

export default class PurgeMessageCtxCommand extends Command {
    constructor() {
        super({
            name: "Purge messages",
            type: ApplicationCommandType.Message,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction<"cached">, _ephemeral: never, config: Config): Promise<void> {
        if (!interaction.channel) return;

        const { success, error } = config.emojis;

        const targetUser = interaction.targetMessage.author;
        const targetMember = interaction.targetMessage.member;

        if (targetMember) {
            const notModerateableReason = validateModerationAction({
                config,
                executorId: interaction.user.id,
                target: targetMember
            });

            if (notModerateableReason) {
                await interaction.reply({
                    content: `${error} ${notModerateableReason}`,
                    ephemeral: true
                });
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
                await interaction.reply({
                    content: `${error} There are no messages to purge.`,
                    ephemeral: true
                });
                return;
            }

            await interaction.reply({
                content: `${success} Successfully purged \`${purgedMessageCount}\` messages by ${targetUser}.`,
                ephemeral: true
            });
        } catch (_err) {
            const err = _err as Error;

            await interaction.reply({
                content: `${error} Failed to purge messages: ${err.message}`,
                ephemeral: true
            });
        }
    }
}