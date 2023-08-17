import { Colors, EmbedBuilder, Events, GuildMember, GuildTextBasedChannel, hyperlink, Message } from "discord.js";

import { handleBanRequestAutoMute, validateRequest } from "../utils/moderation";
import { handleReasonChange } from "../interactions/commands/infraction";
import { formatLogContent, sendLog } from "../utils/logging";
import { LoggingEvent } from "../types/config";
import { RequestType } from "../types/utils";
import { referenceLog } from "../utils";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";

export default class MessageUpdateEventListener extends EventListener {
    constructor() {
        super(Events.MessageUpdate);
    }

    async execute(oldMessage: Message<true>, newMessage: Message<true>): Promise<void> {
        if (!newMessage.inGuild()) return;
        const config = ClientManager.config(newMessage.guildId)!;

        if (newMessage.channelId === config.channels?.muteRequestQueue || newMessage.channelId === config.channels?.banRequestQueue) {
            if (newMessage.reactions.cache.some(r =>
                r.users.cache.size &&
                !r.users.cache.has(newMessage.client.user.id)
            )) return;

            const requestType = newMessage.channelId === config.channels?.muteRequestQueue
                ? RequestType.Mute
                : RequestType.Ban;

            const isAutoMuteEnabled = requestType === RequestType.Ban
                && config.actionAllowed(newMessage.member as GuildMember, {
                    permission: "autoMuteBanRequests",
                    requiredValue: true
                });

            try {
                const { targetMember, reason } = await validateRequest({
                    isAutoMuteEnabled,
                    requestType,
                    message: newMessage,
                    config
                });

                const request = ClientManager.cache.requests.get(newMessage.id);
                if (request && request.infractionId) {
                    await handleReasonChange({
                        infractionId: request.infractionId,
                        newReason: reason,
                        updatedBy: newMessage.author,
                        guildId: newMessage.guildId
                    });
                } else if (targetMember && isAutoMuteEnabled) {
                    await handleBanRequestAutoMute({
                        targetMember,
                        reason,
                        config,
                        message: newMessage
                    });
                }
            } catch (err) {
                const reason = err as string;
                const reaction = reason.includes("already been submitted") ? "🔄" : "⚠️";
                const existingReaction = newMessage.reactions.cache
                    .filter(r => r.me && r.emoji.name !== reaction)
                    .first();

                if (existingReaction) await existingReaction.users.remove(ClientManager.client.user?.id);

                const [reply] = await Promise.all([
                    newMessage.reply({
                        content: reason,
                        allowedMentions: { parse: [], repliedUser: true }
                    }),
                    newMessage.react(reaction)
                ]);

                // Remove after 5 seconds
                setTimeout(async() => {
                    await reply.delete().catch(() => null);
                }, 5000);
            }
        }

        // Log the updated message

        if (
            newMessage.author.bot ||
            !newMessage.content ||
            !oldMessage.author ||
            newMessage.content === oldMessage.content
        ) return;

        const channel = newMessage.channel as GuildTextBasedChannel;
        const log = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setDescription(hyperlink("Jump to message", newMessage.url))
            .setAuthor({
                name: "Message Updated",
                iconURL: "attachment://messageUpdate.png"
            })
            .setFields([
                {
                    name: "Author",
                    value: `${newMessage.author} (\`${newMessage.author.id}\`)`
                },
                {
                    name: "Channel",
                    value: `${channel} (\`#${channel.name}\`)`
                },
                {
                    name: "Before",
                    value: formatLogContent(oldMessage.content)
                },
                {
                    name: "After",
                    value: formatLogContent(newMessage.content)
                }
            ])
            .setTimestamp();

        const embeds = [log];
        const files = [{
            attachment: "./icons/messageUpdate.png",
            name: "messageUpdate.png"
        }];

        if (newMessage.reference) {
            referenceLog(newMessage).then(res => {
                embeds.unshift(res.embed);
                files.push(res.icon);
            });
        }

        await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channel
        });
    }
}