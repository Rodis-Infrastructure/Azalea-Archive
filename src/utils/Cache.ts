import { CacheType } from "./Types";
import { Message } from "discord.js";
import { conn } from "../db";

import ClientManager from "../Client";

export function getCachedMessageIds(data: {
    authorId?: string,
    channelId: string,
    guildId: string,
    limit: number
}): string[] {
    const { authorId, channelId, guildId, limit } = data;

    const messageCache = ClientManager.cache.get(CacheType.Messages)!;
    return messageCache.store
        .filter((message, id) => {
            const shouldPurge = message.channelId === channelId
                && message.guildId === guildId
                && (!authorId || message.authorId === authorId);

            if (shouldPurge) messageCache.store.delete(id);
            return shouldPurge;
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((_, id) => id)
        .slice(0, limit);
}

export function cacheMessage(message: Message | string, params?: { deleted: boolean }) {
    const messageCache = ClientManager.cache.get(CacheType.Messages)!;
    if (!params?.deleted && typeof message !== "string") {
        messageCache.store.set(message.id, {
            authorId: message.author.id,
            channelId: message.channel.id,
            guildId: message.guild!.id,
            createdAt: message.createdTimestamp
        });
        return;
    }

    const removed = messageCache.store.delete(message as string);
    if (!removed) messageCache.remove.add(message as string);
}

export async function processCachedMessages(): Promise<void> {
    const messageCache = ClientManager.cache.get(CacheType.Messages)!;
    const remove = conn.prepare("DELETE FROM messages WHERE id = ?");
    const store = conn.prepare(`
		INSERT INTO messages (id, authorId, channelId, guildId, createdAt)
		VALUES (?, ?, ?, ?, ?)
    `);

    messageCache.remove.forEach(message => remove.run(message));
    messageCache.store.forEach((data, messageId) => {
        store.run(
            messageId,
            data.authorId,
            data.channelId,
            data.guildId,
            data.createdAt
        );
    });

    await store.finalize();
    await remove.finalize();

    messageCache.store.clear();
    messageCache.remove.clear();
}