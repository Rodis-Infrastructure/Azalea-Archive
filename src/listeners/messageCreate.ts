import { cacheMessage } from "../utils/cache";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, Message } from "discord.js";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";
import { validateRequest } from "../utils/moderation";
import { RequestType } from "../types/utils";

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
            const deleteButton = new ButtonBuilder()
                .setCustomId("delete")
                .setLabel("🗑")
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(deleteButton);
            const requestType = message.channelId === config.channels?.muteRequestQueue
                ? RequestType.Mute
                : RequestType.Ban;

            try {
                await validateRequest({
                    requestType,
                    message,
                    config
                });
            } catch (err) {
                const reason = err as string;
                const reaction = reason.includes("already been submitted") ? "🔄" : "⚠️";

                await Promise.all([
                    message.react(reaction),
                    message.reply({
                        content: reason,
                        components: [actionRow],
                        allowedMentions: { parse: [] }
                    })
                ]);
            }
        }
    }
}