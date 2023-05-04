import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";

import { ApplicationCommandType, GuildTextBasedChannel, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../utils/Types";
import { muteMember } from "../../utils/ModerationUtils";
import Config from "../../utils/Config";

export default class QuickMute60Command extends ContextMenuCommand {
    constructor() {
        super({
            name: "Quick mute (60m)",
            defer: InteractionResponseType.EphemeralDefer,
            type: ApplicationCommandType.Message,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction, config: Config): Promise<void> {
        const message = interaction.targetMessage;
        const { success, error } = config.emojis;

        if (!message.member) {
            await interaction.editReply(`${error} Failed to fetch the message author.`);
            return;
        }

        const reason = message.content;
        const res = await muteMember({
            offender: message.member,
            moderator: interaction.user,
            duration: "60m",
            config,
            reason
        });

        const channelId = config.channels.staffCommands;
        if (!channelId) return;

        const channel = await interaction.guild?.channels.fetch(channelId) as GuildTextBasedChannel;
        if (!channel) return;

        if (typeof res === "number") {
            const muteDetails = `muted **${message.author?.tag}** until <t:${res}:F> | Expires <t:${res}:R> (\`${reason}\`)`;

            await Promise.all([
                interaction.editReply(`${success} Successfully ${muteDetails}`),
                channel.send(`${success} **${interaction.user.tag}** has successfully ${muteDetails}`),
                message.delete().catch(() => null)
            ]);

            return;
        }

        await interaction.editReply(`${error} ${interaction.user} ${res}`);
    }
}