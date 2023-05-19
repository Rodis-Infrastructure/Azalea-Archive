import { ApplicationCommandType, GuildTextBasedChannel, MessageContextMenuCommandInteraction } from "discord.js";

import { InteractionResponseType } from "../../utils/Types";
import { purgeMessages } from "../../utils/ModerationUtils";

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
        const { author } = interaction.targetMessage;

        try {
            const purgedMessages = await purgeMessages({
                channel: interaction.channel as GuildTextBasedChannel,
                amount: 100,
                authorId: author.id
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