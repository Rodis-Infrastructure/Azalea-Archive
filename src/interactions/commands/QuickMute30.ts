import { ApplicationCommandType, MessageContextMenuCommandInteraction } from "discord.js";
import { formatReason, formatTimestamp } from "../../utils";
import { InteractionResponseType } from "../../utils/Types";
import { muteMember } from "../../utils/ModerationUtils";

import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";
import Config from "../../utils/Config";

export default class QuickMute30Command extends ContextMenuCommand {
    constructor() {
        super({
            name: "Quick mute (30m)",
            defer: InteractionResponseType.Default,
            type: ApplicationCommandType.Message,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction, _: never, config: Config): Promise<void> {
        const message = interaction.targetMessage;
        const { success, error } = config.emojis;

        if (!message.member) {
            await interaction.reply({
                content: `${error} Failed to fetch the message author.`,
                ephemeral: true
            });
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

        /* The result is the mute's expiration timestamp */
        if (typeof res === "number") {
            const reply = `quick muted **${message.author?.tag}** until ${formatTimestamp(res, "F")} | Expires ${formatTimestamp(res, "R")}${formatReason(reason)}`;

            await Promise.all([
                interaction.reply({
                    content: `${success} Successfully ${reply}`,
                    ephemeral: true
                }),
                config.sendInfractionConfirmation({
                    guild: interaction.guild!,
                    message: reply,
                    authorId: message.author.id,
                    channelId: message.channel.id,
                    reason
                }),
                message.delete().catch(() => null)
            ]);
            return;
        }

        /* The result is an error message */
        await interaction.reply({
            content: `${error} ${res}`,
            ephemeral: true
        });
    }
}