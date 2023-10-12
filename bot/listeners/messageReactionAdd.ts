import { EmbedBuilder, Events, GuildEmoji, hyperlink, Message, MessageReaction, ReactionEmoji, User } from "discord.js";
import { handleQuickMute, purgeMessages, validateModerationAction } from "@/utils/moderation";
import { LoggingEvent, RoleInteraction } from "@/types/config";
import { formatLogContent, sendLog } from "@/utils/logging";
import { handleRequestManagement } from "@/utils/requests";
import { QuickMuteDuration } from "@/types/moderation";

import EventListener from "@/handlers/listeners/eventListener";
import Config from "@/utils/config";

export default class MessageReactionAddEventListener extends EventListener {
    constructor() {
        super(Events.MessageReactionAdd);
    }

    async execute(reaction: MessageReaction, userExecutor: User): Promise<void> {
        if (userExecutor.bot) return;

        const message = reaction.message.partial
            ? await reaction.message.fetch().catch(() => null)
            : reaction.message;

        if (!message?.inGuild()) return;
        if (reaction.count === 1) await handleReactionLog(message, userExecutor, reaction.emoji);

        const config = Config.get(message.guildId);
        if (!config) return;

        const { emojis } = config;

        const memberExecutor = await message.guild.members.fetch(userExecutor.id);
        const emojiId = reaction.emoji.id ?? reaction.emoji.name;

        if (!emojiId) return;

        const isQuickMute = emojis.quickMute30?.includes(emojiId) || emojis.quickMute60?.includes(emojiId);

        // Quick mutes - 30 minutes and 1 hour
        if (message.member && isQuickMute) {
            let duration = QuickMuteDuration.Short;
            let reactionPermission = "quickMute30";

            if (emojis.quickMute60?.includes(emojiId)) {
                duration = QuickMuteDuration.Long;
                reactionPermission = "quickMute60";
            }

            if (!config.canPerformAction(memberExecutor, RoleInteraction.Reaction, reactionPermission)) return;

            const { response, success } = await handleQuickMute({
                message,
                executorId: userExecutor.id,
                duration,
                config
            });

            if (!success) {
                await config.sendNotification(response, {
                    allowMentions: true
                });
            }
        }

        // Message purging
        if (emojis.purgeMessages?.includes(emojiId)) {
            if (!config.canPerformAction(memberExecutor, RoleInteraction.Reaction, "purgeMessages")) return;

            if (message.member) {
                const notModerateableReason = validateModerationAction({
                    config,
                    executorId: userExecutor.id,
                    target: message.member
                });

                if (notModerateableReason) {
                    await config.sendNotification(`${emojis.error} ${userExecutor} ${notModerateableReason}`, {
                        allowMentions: true
                    });

                    return;
                }
            }

            await Promise.all([
                reaction.remove(),
                purgeMessages({
                    channel: message.channel,
                    amount: 100,
                    targetId: message.author.id,
                    executorId: userExecutor.id
                })
            ]).catch(() => null);
        }

        if (emojis.approveRequest?.includes(emojiId) || emojis.denyRequest?.includes(emojiId)) {
            await handleRequestManagement({
                message,
                executor: memberExecutor,
                config,
                emojiId
            });
        }
    }
}

async function handleReactionLog(message: Message<true>, user: User, emoji: GuildEmoji | ReactionEmoji): Promise<void> {
    const embed = new EmbedBuilder()
        .setColor(0x9C84EF)
        .setAuthor({ name: "Reaction Added", iconURL: "attachment://addReaction.png" })
        .setDescription(hyperlink("Jump to message", message.url))
        .setTimestamp();

    if (emoji.id && emoji.url) {
        embed.setFields({
            name: "Emoji",
            value: `\n\n\`<:${emoji.name}:${emoji.id}>\` (${hyperlink("view", emoji.url)})`
        });
    } else {
        embed.setFields({
            name: "Emoji",
            value: `\n\n${emoji}`
        });
    }

    embed.addFields([
        {
            name: "User",
            value: `${user} (\`${user.id}\`)`
        },
        {
            name: "Channel",
            value: `${message.channel} (\`#${message.channel.name}\`)`
        },
        {
            name: "Content",
            value: formatLogContent(message.content)
        }
    ]);

    await sendLog({
        event: LoggingEvent.Message,
        sourceChannel: message.channel,
        options: {
            embeds: [embed],
            files: [{
                attachment: "./icons/addReaction.png",
                name: "addReaction.png"
            }]
        }
    });
}