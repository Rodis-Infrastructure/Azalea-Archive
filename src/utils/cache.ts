import { AnyComponentInteraction, InteractionCustomIdFilter } from "../types/interactions";
import { CachedRequest, MessageCache } from "../types/cache";
import { allQuery, getQuery, runQuery } from "../db";
import { MessageModel } from "../types/db";
import { sanitizeString } from "./index";
import { Collection } from "discord.js";
import { Command, ComponentInteraction } from "../handlers/interactions/interaction";

export default class Cache {
    static interactions = new Collection<InteractionCustomIdFilter, ComponentInteraction<AnyComponentInteraction>>();
    static commands = new Collection<string, Command>();
    private static items = new Collection<string, Cache>();
    requests: Collection<string, CachedRequest>;
    messages: MessageCache;

    constructor() {
        this.requests = new Collection<string, CachedRequest>();
        this.messages = {
            store: new Collection<string, MessageModel>()
        };
    }

    static get(guildId: string): Cache {
        return this.items.get(guildId) || Cache.create(guildId);
    }

    static create(guildId: string): Cache {
        const cache = new Cache();
        this.items.set(guildId, cache);
        return cache;
    }

    static getComponentInteraction(customId: string): ComponentInteraction<AnyComponentInteraction> | undefined {
        return this.interactions.find(item => {
            const { name } = item.data;

            if (typeof name === "string") return name === customId;
            if ("startsWith" in name) return customId.startsWith(name.startsWith);
            if ("endsWith" in name) return customId.endsWith(name.endsWith);
            if ("includes" in name) return customId.includes(name.includes);

            return false;
        });
    }

    static async storeMessages(): Promise<void> {
        const messages = this.items.flatMap(cache => cache.messages.store);
        const messagesToInsert = messages.map((data, messageId) => `(
            ${messageId}, 
            ${data.author_id}, 
            ${data.channel_id}, 
            ${data.guild_id}, 
            ${data.created_at},
            ${sanitizeString(data.content)},
            ${data.reference_id || null},
            ${data.category_id || null},
            ${data.deleted ? 1 : 0}
        )`).join(",");

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
        }
    }

    getMessageIds(data: {
        authorId?: string,
        channelId: string,
        limit: number
    }): string[] {
        const { authorId, channelId, limit } = data;
        return this.messages.store
            .filter(message =>
                message.channel_id === channelId
                && (!authorId || message.author_id === authorId)
                && !message.deleted
            )
            .sort((a, b) => b.created_at - a.created_at)
            .map((_, id) => id)
            .slice(0, limit);
    }

    async handleMessageEdit(messageId: string, updatedContent: string): Promise<void> {
        const message = this.messages.store.get(messageId);

        if (message) {
            message.content = updatedContent;
        } else {
            await getQuery<MessageModel>(`
                UPDATE messages
                SET content = ${sanitizeString(updatedContent)}
                WHERE message_id = ${messageId};
            `);
        }
    }

    async handleDeletedMessage(messageId: string, fetchReference: boolean): Promise<Record<"message" | "reference", MessageModel | null>> {
        let message = this.messages.store.get(messageId) || null;
        let reference: MessageModel | null = null;

        if (message) {
            message.deleted = true;
        } else {
            message = await getQuery<MessageModel>(`
                UPDATE messages
                SET deleted = 1
                WHERE message_id = ${messageId}
                RETURNING *;
            `);
        }

        if (fetchReference && message?.reference_id) {
            reference = await this.getMessage(message.reference_id);
        }

        return { message, reference };
    }

    getMessage(messageId: string): Promise<MessageModel | null> {
        const cachedMessage = this.messages.store.get(messageId);
        if (cachedMessage) return Promise.resolve(cachedMessage);

        return getQuery<MessageModel>(`
            SELECT *
            FROM messages
            WHERE message_id = ${messageId};
        `);
    }

    async handleBulkDeletedMessages(messageIds: string[]): Promise<MessageModel[]> {
        const uncachedMessages: string[] = [];
        let messages: MessageModel[] = [];

        for (const messageId of messageIds) {
            const cachedMessage = this.messages.store.get(messageId);

            if (!cachedMessage) {
                uncachedMessages.push(messageId);
            } else {
                messages.push(cachedMessage);
                cachedMessage.deleted = true;
                this.messages.store.set(messageId, cachedMessage);
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
}