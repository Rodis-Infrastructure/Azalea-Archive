import { allQuery, getQuery, runQuery } from "../db";
import { MessageModel } from "../types/db";

import ClientManager from "../client";
import { stringify } from "./index";

export function getCachedMessageIds(data: {
    authorId?: string,
    channelId: string,
    guildId: string,
    limit: number
}): string[] {
    const { authorId, channelId, guildId, limit } = data;
    return ClientManager.cache.messages.store
        .filter(message =>
            message.channel_id === channelId
            && message.guild_id === guildId
            && (!authorId || message.author_id === authorId)
            && !message.deleted
        )
        .sort((a, b) => b.created_at - a.created_at)
        .map((_, id) => id)
        .slice(0, limit);
}

export async function processPartialDeletedMessage(messageId: string, options: {
    fetchReference: boolean
}): Promise<Record<"message" | "reference", MessageModel | null>> {
    const { fetchReference } = options;
    const cache = ClientManager.cache.messages.store;
    const data: Record<"message" | "reference", MessageModel | null> = {
        message: cache.get(messageId) || null,
        reference: null
    };

    if (data.message) {
        data.message.deleted = true;
    } else {
        data.message = await getQuery<MessageModel>(`
            UPDATE messages
            SET deleted = 1
            WHERE message_id = ${messageId}
            RETURNING *;
        `);
    }

    if (fetchReference && data.message?.reference_id) {
        data.reference = await fetchMessage(data.message.reference_id);
    }

    return data;
}

export async function processEditedMessage(messageId: string, updatedContent: string) {
    const cache = ClientManager.cache.messages.store;
    const message = cache.get(messageId) || null;

    if (message) {
        message.content = updatedContent;
    } else {
        await getQuery<MessageModel>(`
            UPDATE messages
            SET content = ${stringify(updatedContent)}
            WHERE message_id = ${messageId};
        `);
    }
}

export function fetchMessage(messageId: string): Promise<MessageModel | null> {
    const cachedMessage = ClientManager.cache.messages.store.get(messageId);
    if (cachedMessage) return Promise.resolve(cachedMessage);

    return getQuery<MessageModel>(`
        SELECT *
        FROM messages
        WHERE message_id = ${messageId};
    `);
}

export async function processBulkDeletedMessages(messageIds: string[]): Promise<MessageModel[]> {
    const cache = ClientManager.cache.messages.store;
    const uncachedMessages: string[] = [];
    let messages: MessageModel[] = [];

    for (const messageId of messageIds) {
        const message = cache.get(messageId);

        if (!message) {
            uncachedMessages.push(messageId);
        } else {
            messages.push(message);
            message.deleted = true;
            cache.set(messageId, message);
        }
    }

    if (uncachedMessages.length) {
        const storedMessages = await allQuery<MessageModel>(`
            UPDATE messages
            SET deleted = 1
            WHERE message_id IN (${uncachedMessages.join(",")})
            RETURNING *;
        `);

        messages = messages.concat(storedMessages);
    }

    return messages;
}

export async function processCachedMessages(): Promise<void> {
    const cache = ClientManager.cache.messages;
    const messagesToInsert = cache.store
        .map((data, messageId) => `(
            ${messageId}, 
            ${data.author_id}, 
            ${data.channel_id}, 
            ${data.guild_id}, 
            ${data.created_at},
            ${stringify(data.content)},
            ${data.reference_id || null},
            ${data.category_id || null}.
            ${data.deleted}
        )`)
        .join(",");

    if (messagesToInsert) {
        // @formatter:off
        await runQuery(`
            INSERT INTO messages (
                message_id,
                author_id,
                channel_id,
                guild_id,
                created_at,
                content,
                reference_id,
                category_id,
                deleted
            )
            VALUES ${messagesToInsert};
        `);

        cache.store.clear();
    }
}