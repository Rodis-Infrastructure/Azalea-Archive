import { Message } from "discord.js";
import { runQuery } from "../db";

import ClientManager from "../client";

export function getCachedMessageIds(data: {
    authorId?: string,
    channelId: string,
    guildId: string,
    limit: number
}): string[] {
    const { authorId, channelId, guildId, limit } = data;

    const cache = ClientManager.cache.messages;
    return cache.store
        .filter((message, id) => {
            const shouldPurge = message.channelId === channelId
                && message.guildId === guildId
                && (!authorId || message.authorId === authorId);

            if (shouldPurge) cache.store.delete(id);
            return shouldPurge;
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((_, id) => id)
        .slice(0, limit);
}

export function cacheMessage(message: Message | string, params?: { deleted: boolean }) {
    const cache = ClientManager.cache.messages;
    if (!params?.deleted && typeof message !== "string") {
        cache.store.set(message.id, {
            authorId: message.author.id,
            channelId: message.channel.id,
            guildId: message.guild!.id,
            createdAt: message.createdTimestamp
        });
        return;
    }

    const removed = cache.store.delete(message as string);
    if (!removed) cache.remove.add(message as string);
}

export async function processCachedMessages(): Promise<void> {
    const cache = ClientManager.cache.messages;
    const messagesToRemove = Array.from(cache.remove).join(",");
    const messagesToInsert = cache.store
        .map((data, messageId) => `(
            ${messageId}, 
            ${data.authorId}, 
            ${data.channelId}, 
            ${data.guildId}, 
            ${data.createdAt}
        )`)
        .join(",");

    if (messagesToRemove) {
        await runQuery(`
			DELETE
			FROM messages
			WHERE message_id IN (${messagesToRemove});
        `);

        cache.remove.clear();
    }

    if (messagesToInsert) {
        await runQuery(`
			INSERT INTO messages (message_id, author_id, channel_id, guild_id, created_at)
			VALUES ${messagesToInsert};
        `);

        cache.store.clear();
    }
}