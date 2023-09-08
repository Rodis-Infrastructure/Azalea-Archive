import { handleBanRequestAutoMute, validateRequest } from "../utils/moderation";
import { serializeMessageToDatabaseModel } from "../utils";
import { Events, GuildMember, Message } from "discord.js";
import { LoggingEvent } from "../types/config";
import { RequestType } from "../types/utils";
import { sendLog } from "../utils/logging";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";

export default class MessageCreateEventListener extends EventListener {
    constructor() {
        super(Events.MessageCreate);
    }

    async execute(message: Message<true>): Promise<void> {
        if (!message.inGuild() || message.author.bot) return;

        // Cache the message
        const serializedMessage = serializeMessageToDatabaseModel(message);
        ClientManager.cache.messages.store.set(message.id, serializedMessage);

        const config = ClientManager.config(message.guildId);
        if (!config) return;

        // Handle media to link conversion
        if (message.channelId === config.channels?.mediaConversion && message.attachments.size) {
            const mediaStorageLog = await sendLog({
                event: LoggingEvent.Media,
                guildId: message.guildId,
                options: {
                    content: `Media stored by ${message.author}`,
                    files: Array.from(message.attachments.values()),
                    allowedMentions: { parse: [] }
                }
            }) as Message<true>;

            const mediaURLs = mediaStorageLog.attachments.map(({ url }) => `<${url}>`);
            await Promise.all([
                message.delete().catch(() => null),
                message.channel.send(`${message.author} Your media links:\n\n>>> ${mediaURLs.join("\n")}`)
            ]);
        }

        // Handle mute/ban requests
        if (
            (message.channelId === config.channels?.muteRequestQueue || message.channelId === config.channels?.banRequestQueue) &&
            !message.reactions.cache.size
        ) {
            const requestType = message.channelId === config.channels?.muteRequestQueue
                ? RequestType.Mute
                : RequestType.Ban;

            try {
                const isAutoMuteEnabled = requestType === RequestType.Ban
                    && config.actionAllowed(message.member as GuildMember, {
                        permission: "autoMuteBanRequests",
                        requiredValue: true
                    });

                const { targetMember, reason } = await validateRequest({
                    isAutoMuteEnabled,
                    requestType,
                    message,
                    config
                });

                if (targetMember && isAutoMuteEnabled) {
                    await handleBanRequestAutoMute({
                        targetMember,
                        reason,
                        config,
                        message
                    });
                }
            } catch (err) {
                const reason = err as string;
                const reaction = reason.includes("already been submitted") ? "🔄" : "⚠️";

                const [reply] = await Promise.all([
                    message.reply({
                        content: reason,
                        allowedMentions: { parse: [], repliedUser: true }
                    }),
                    message.react(reaction)
                ]);

                // Remove after 5 seconds
                setTimeout(async() => {
                    await reply.delete().catch(() => null);
                }, 5000);
            }
        }
    }
}