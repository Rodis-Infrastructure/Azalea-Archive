import { ApplicationCommandType, GuildTextBasedChannel, MessageContextMenuCommandInteraction } from "discord.js";
import { purgeMessages, validateModerationAction } from "../../utils/moderation";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";

import Config from "../../utils/config";

export default class PurgeMessageCtxCommand extends Command {
    constructor() {
        super({
            name: "Purge messages",
            type: ApplicationCommandType.Message,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction, _: never, config: Config): Promise<void> {
        const { success, error } = config.emojis;
        const { author, member } = interaction.targetMessage;

        if (member) {
            const notModerateableReason = validateModerationAction({
                config,
                executorId: interaction.user.id,
                target: member
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
            const purgedMessages = await purgeMessages({
                channel: interaction.channel as GuildTextBasedChannel,
                amount: 100,
                targetId: author.id,
                executorId: interaction.user.id
            });

            if (!purgedMessages) {
                await interaction.reply({
                    content: `${error} There are no messages to purge.`,
                    ephemeral: true
                });
                return;
            }

            await interaction.reply({
                content: `${success} Successfully purged \`${purgedMessages}\` messages by **${author.tag}**.`,
                ephemeral: true
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: `${error} Failed to purge messages.`,
                ephemeral: true
            });
        }
    }
}