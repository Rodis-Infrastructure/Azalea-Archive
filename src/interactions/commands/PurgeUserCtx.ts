import { ApplicationCommandType, GuildTextBasedChannel, UserContextMenuCommandInteraction } from "discord.js";

import { InteractionResponseType } from "../../utils/Types";
import { purgeMessages } from "../../utils/ModerationUtils";

import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";
import Config from "../../utils/Config";

export default class PurgeUserCtxCommand extends ContextMenuCommand {
    constructor() {
        super({
            name: "Purge messages",
            type: ApplicationCommandType.User,
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: UserContextMenuCommandInteraction, config: Config): Promise<void> {
        const { success, error } = config.emojis;

        try {
            const purgedMessages = await purgeMessages({
                channel: interaction.channel as GuildTextBasedChannel,
                amount: 100,
                authorId: interaction.targetId
            });

            if (!purgedMessages) {
                await interaction.editReply(`${error} There are no messages to purge.`);
                return;
            }

            await interaction.editReply(`${success} Successfully purged \`${purgedMessages}\` messages by **${interaction.targetUser.tag}**.`);
        } catch {
            await interaction.editReply(`${error} Failed to purge messages.`);
        }
    }
}