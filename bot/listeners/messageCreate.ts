import { getRequestType, handleBanRequestAutoMute, validateRequest } from "@bot/utils/requests";
import { Events, hideLinkEmbed, Message, PartialMessage } from "discord.js";
import { LoggingEvent, RolePermission } from "@bot/types/config";
import { Requests } from "@bot/types/requests";
import { ensureError, serializeMessage } from "@bot/utils";
import { sendLog } from "@bot/utils/logging";

import EventListener from "@bot/handlers/listeners/eventListener";
import Config from "@bot/utils/config";
import Cache from "@bot/utils/cache";
import { ErrorCause } from "@bot/types/internals";

export default class MessageCreateEventListener extends EventListener {
    constructor() {
        super(Events.MessageCreate);
    }

    async execute(createdMessage: Message | PartialMessage): Promise<void> {
        const message = createdMessage.partial
            ? await createdMessage.fetch().catch(() => null)
            : createdMessage;

        if (!message?.inGuild() || message.author.bot) return;

        // Cache the message
        const cache = Cache.get(message.guildId);
        cache.messages.store.set(message.id, serializeMessage(message));

        const config = Config.get(message.guildId);
        if (!config) return;

        const reactions = config.getAutoReactions(message.channelId);
        if (reactions.length) await Promise.all(reactions.map(r => message.react(r)));

        // Handle media to link conversion
        if (
            message.channelId === config.channels.mediaConversion &&
            message.attachments.size &&
            !message.content
        ) {
            const log = await sendLog({
                event: LoggingEvent.Media,
                guildId: message.guildId,
                options: {
                    content: `Media stored by ${message.author}`,
                    files: Array.from(message.attachments.values()),
                    allowedMentions: { parse: [] }
                }
            });

            if (!log) {
                await message.reply("Failed to store media, please contact the bot owner(s) if this keeps happening.");
                return;
            }

            await Promise.all([
                message.delete().catch(() => null),
                message.channel.send(`${message.author} Your media log: ${log.url} (${hideLinkEmbed(log.url)})`)
            ]);
        }

        const requestType = getRequestType(message.channelId, config);

        // Handle mute/ban requests
        if (requestType && message.member) {
            try {
                const isAutoMuteEnabled = requestType === Requests.Ban
                    && config.hasPermission(message.member, RolePermission.AutoMuteBanRequests);

                const { target, reason } = await validateRequest({
                    request: message,
                    requestType,
                    config
                });

                if (target && isAutoMuteEnabled) {
                    await handleBanRequestAutoMute({
                        request: message,
                        target,
                        reason,
                        config
                    });
                }
            } catch (_error) {
                const error = ensureError(_error);
                const emoji = error.cause === ErrorCause.DuplicateRequest ? "🔄" : "⚠️";

                const [response] = await Promise.all([
                    message.reply({
                        content: error.message,
                        allowedMentions: { parse: [], repliedUser: true }
                    }),
                    message.react(emoji)
                ]);

                // Remove after 5 seconds
                setTimeout(async() => {
                    await response.delete().catch(() => null);
                }, 5000);
            }
        }
    }
}