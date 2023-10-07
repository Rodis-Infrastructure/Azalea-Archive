import { handleBanRequestAutoMute, validateRequest } from "../utils/moderation";
import { Events, GuildMember, Message } from "discord.js";
import { LoggingEvent } from "../types/config";
import { RequestType } from "../types/utils";
import { sendLog } from "../utils/logging";
import { serializeMessage } from "../db";

import EventListener from "../handlers/listeners/eventListener";
import Config from "../utils/config";
import Cache from "../utils/cache";

export default class MessageCreateEventListener extends EventListener {
    constructor() {
        super(Events.MessageCreate);
    }

    async execute(message: Message<true>): Promise<void> {
        if (!message.inGuild() || message.author.bot) return;

        const fetchedMessage = message.partial
            ? await message.fetch().catch(() => null)
            : message;

        if (!fetchedMessage) return;

        // Cache the message
        const cache = Cache.get(fetchedMessage.guildId);
        cache.messages.store.set(fetchedMessage.id, serializeMessage(fetchedMessage));

        const config = Config.get(fetchedMessage.guildId);
        if (!config) return;

        const reactions = config.getAutoReactions(fetchedMessage.channelId);
        if (reactions.length) await Promise.all(reactions.map(r => fetchedMessage.react(r)));

        // Handle media to link conversion
        if (fetchedMessage.channelId === config.channels?.mediaConversion && fetchedMessage.attachments.size) {
            const mediaStorageLog = await sendLog({
                event: LoggingEvent.Media,
                guildId: fetchedMessage.guildId,
                options: {
                    content: `Media stored by ${fetchedMessage.author}`,
                    files: Array.from(fetchedMessage.attachments.values()),
                    allowedMentions: { parse: [] }
                }
            }) as Message<true>;

            const mediaURLs = mediaStorageLog.attachments.map(({ url }) => url);
            await Promise.all([
                fetchedMessage.delete().catch(() => null),
                fetchedMessage.channel.send(`${fetchedMessage.author} Your media links: ${mediaStorageLog.url}\n\n>>> ${mediaURLs.join("\n")}`)
            ]);
        }

        // Handle mute/ban requests
        if (
            (fetchedMessage.channelId === config.channels?.muteRequestQueue || fetchedMessage.channelId === config.channels?.banRequestQueue) &&
            !fetchedMessage.reactions.cache.size
        ) {
            const requestType = fetchedMessage.channelId === config.channels?.muteRequestQueue
                ? RequestType.Mute
                : RequestType.Ban;

            try {
                const isAutoMuteEnabled = requestType === RequestType.Ban
                    && config.hasPermission(fetchedMessage.member as GuildMember, {
                        permission: "autoMuteBanRequests",
                        requiredValue: true
                    });

                const { targetMember, reason } = await validateRequest({
                    isBanRequest: isAutoMuteEnabled,
                    requestType,
                    request: fetchedMessage,
                    config
                });

                if (targetMember && isAutoMuteEnabled) {
                    await handleBanRequestAutoMute({
                        target: targetMember,
                        reason,
                        config,
                        request: fetchedMessage
                    });
                }
            } catch (err) {
                const reason = err as string;
                const reaction = reason.includes("already been submitted") ? "🔄" : "⚠️";

                const [reply] = await Promise.all([
                    fetchedMessage.reply({
                        content: reason,
                        allowedMentions: { parse: [], repliedUser: true }
                    }),
                    fetchedMessage.react(reaction)
                ]);

                // Remove after 5 seconds
                setTimeout(async() => {
                    await reply.delete().catch(() => null);
                }, 5000);
            }
        }
    }
}