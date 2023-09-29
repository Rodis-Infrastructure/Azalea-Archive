import { ApplicationCommandType, GuildTextBasedChannel, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../types/interactions";
import { muteMember, purgeMessages } from "../../utils/moderation";
import { Command } from "../../handlers/interactions/interaction";
import { discordTimestamp } from "../../utils";

import Config from "../../utils/config";

export default class QuickMute30Command extends Command {
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
        const [res] = await muteMember(message.member, {
            quick: true,
            moderator: interaction.user,
            duration: "30m",
            config,
            reason
        });

        /* The result is the mute's expiration timestamp */
        if (typeof res === "number") {
            const reply = `quick muted **${message.author?.tag}** until ${discordTimestamp(res, "F")} | Expires ${discordTimestamp(res, "R")}`;

            await Promise.all([
                purgeMessages({
                    channel: message.channel as GuildTextBasedChannel,
                    amount: 100,
                    moderatorId: interaction.user.id,
                    authorId: message.author.id
                }),
                interaction.reply({
                    content: `${success} Successfully ${reply}`,
                    ephemeral: true
                }),
                config.sendConfirmation({
                    message: reply,
                    authorId: message.author.id,
                    channelId: message.channel.id,
                    reason
                })
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