import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";
import ClientManager from "../../Client";

import { ApplicationCommandType, MessageContextMenuCommandInteraction, TextBasedChannel } from "discord.js";
import { InteractionResponseType } from "../../utils/Types";
import { muteMember } from "../../utils/ModerationUtils";

export default class QuickMute30Command extends ContextMenuCommand {
    constructor() {
        super({
            name: "Quick mute (30m)",
            defer: InteractionResponseType.EphemeralDefer,
            type: ApplicationCommandType.Message,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        const config = ClientManager.config(interaction.guildId!)!;
        const reason = interaction.targetMessage.content;
        const message = interaction.targetMessage;

        if (!message.member) {
            await interaction.editReply(`${config.emojis.error} Failed to fetch the message author.`);
            return;
        }

        const res = await muteMember({
            offender: message.member,
            moderator: interaction.user,
            duration: "30m",
            config,
            reason
        });

        const channelId = config.channels?.staffCommands;
        if (!channelId) return;

        const channel = await interaction.guild?.channels.fetch(channelId) as TextBasedChannel;
        if (!channel) return;

        if (typeof res === "number") {
            const muteDetails = `muted **${message.author?.tag}** until <t:${res}:F> | Expires <t:${res}:R> (\`${reason}\`)`;

            await Promise.all([
                interaction.editReply(`${config.emojis.success} Successfully ${muteDetails}`),
                channel.send(`${config.emojis.success} **${interaction.user.tag}** has successfully ${muteDetails}`),
                message.delete().catch(() => null)
            ]);

            return;
        }

        await interaction.editReply(`${config.emojis.error} ${interaction.user} ${res}`);
    }
}