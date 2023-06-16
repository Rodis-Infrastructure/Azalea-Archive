import { ApplicationCommandType, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../utils/Types";
import { muteMember } from "../../utils/ModerationUtils";

import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";
import Config from "../../utils/Config";
import { formatReason, formatTimestamp } from "../../utils";

export default class QuickMute60Command extends ContextMenuCommand {
    constructor() {
        super({
            name: "Quick mute (60m)",
            defer: InteractionResponseType.Defer,
            type: ApplicationCommandType.Message,
            skipInternalUsageCheck: false,
            ephemeral: true
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
            duration: "60m",
            config,
            reason
        });

        /* The result is the mute's expiration timestamp */
        if (typeof res === "number") {
            const reply = `quick muted **${message.author?.tag}** until ${formatTimestamp(res, "F")} | Expires ${formatTimestamp(res, "R")}${formatReason(reason)}`;

            await Promise.all([
                interaction.editReply(`${success} Successfully ${reply}`),
                config.sendInfractionConfirmation({
                    guild: interaction.guild!,
                    message: reply,
                    authorId: message.author.id,
                    channelId: message.channel.id,
                    reason
                }),
                message.delete()
            ]);

            return;
        }

        /* The result is an error message */
        await interaction.editReply(`${error} ${res}`);
    }
}