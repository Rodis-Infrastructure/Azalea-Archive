import { ApplicationCommandType, GuildTextBasedChannel, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../utils/Types";
import { muteMember } from "../../utils/ModerationUtils";

import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";
import Config from "../../utils/Config";

export default class QuickMute30Command extends ContextMenuCommand {
    constructor() {
        super({
            name: "Quick mute (30m)",
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
        const res = await muteMember(message.member, {
            quick: true,
            moderator: interaction.user,
            duration: "30m",
            config,
            reason
        });

        const confirmationChannelId = config.channels.staffCommands;
        if (!confirmationChannelId) return;

        const confirmationChannel = await interaction.guild!.channels.fetch(confirmationChannelId) as GuildTextBasedChannel;
        if (!confirmationChannel) return;

        /* The result is the mute's expiration timestamp */
        if (typeof res === "number") {
            const reply = `muted **${message.author?.tag}** until <t:${res}:F> | Expires <t:${res}:R> (\`${reason}\`)`;

            await Promise.all([
                interaction.editReply(`${success} Successfully ${reply}`),
                confirmationChannel.send(`${success} **${interaction.user.tag}** has successfully ${reply}`),
                message.delete().catch(() => null)
            ]);

            return;
        }

        /* The result is an error message */
        await interaction.editReply(`${error} ${interaction.user} ${res}`);
    }
}