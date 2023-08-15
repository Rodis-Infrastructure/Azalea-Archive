import { Events, GuildMember, Message } from "discord.js";
import { handleBanRequestAutoMute, validateRequest } from "../utils/moderation";
import { cacheMessage } from "../utils/cache";
import { RequestType } from "../types/utils";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";

export default class MessageCreateEventListener extends EventListener {
    constructor() {
        super(Events.MessageCreate);
    }

    async execute(message: Message<true>): Promise<void> {
        if (!message.guildId || message.author.bot) return;

        cacheMessage(message);
        const config = ClientManager.config(message.guildId)!;

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