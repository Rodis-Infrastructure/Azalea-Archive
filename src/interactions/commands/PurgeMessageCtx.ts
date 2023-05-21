import { ApplicationCommandType, GuildTextBasedChannel, MessageContextMenuCommandInteraction } from "discord.js";

import { InteractionResponseType } from "../../utils/Types";
import { purgeMessages, validateModerationAction } from "../../utils/ModerationUtils";

import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";
import Config from "../../utils/Config";

export default class PurgeMessageCtxCommand extends ContextMenuCommand {
    constructor() {
        super({
            name: "Purge messages",
            type: ApplicationCommandType.Message,
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction, config: Config): Promise<void> {
        const { success, error } = config.emojis;
        const { author, member } = interaction.targetMessage;

        if (member) {
            const notModerateableReason = validateModerationAction({
                config,
                moderatorId: interaction.user.id,
                offender: member
            });

            if (notModerateableReason) {
                await interaction.editReply(`${error} ${notModerateableReason}`);
                return;
            }
        }

        try {
            const purgedMessages = await purgeMessages({
                channel: interaction.channel as GuildTextBasedChannel,
                amount: 100,
                authorId: author.id,
                moderatorId: interaction.user.id
            });

            if (!purgedMessages) {
                await interaction.editReply(`${error} There are no messages to purge.`);
                return;
            }

            await interaction.editReply(`${success} Successfully purged \`${purgedMessages}\` messages by **${author.tag}**.`);
        } catch {
            await interaction.editReply(`${error} Failed to purge messages.`);
        }
    }
}