import { AnyComponentInteraction, ComponentCustomId, CustomId } from "@/types/interactions";
import { allQuery, getQuery, runQuery, sanitizeString } from "@database/utils";
import { Command, Component } from "@/handlers/interactions/interaction";
import { CachedRequest, MessageCache } from "@/types/cache";
import { MessageModel } from "@database/models/message";
import { Collection, Snowflake } from "discord.js";
import { elipsify } from "@/utils/index";

export default class Cache {
    static components = new Collection<ComponentCustomId, Component<AnyComponentInteraction<"cached">>>();
    static globalCommands = new Collection<CustomId, Command>();
    static guildCommands = new Collection<CustomId, Command>();
    private static instances = new Collection<Snowflake, Cache>();
    requests: Collection<Snowflake, CachedRequest>;
    messages: MessageCache;

    private constructor() {
        this.requests = new Collection();
        this.messages = { store: new Collection() };
    }

    static get(guildId: Snowflake): Cache {
        return this.instances.get(guildId) || Cache.create(guildId);
    }

    static create(guildId: Snowflake): Cache {
        const cache = new Cache();
        this.instances.set(guildId, cache);
        return cache;
    }

    static getComponent(customId: CustomId): Component<AnyComponentInteraction<"cached">> | null {
        return this.components.find(item => {
            const { name } = item.data;

            if (typeof name === "string") return name === customId;
            if ("startsWith" in name) return customId.startsWith(name.startsWith);
            if ("endsWith" in name) return customId.endsWith(name.endsWith);
            if ("includes" in name) return customId.includes(name.includes);

            return false;
        }) ?? null;
    }

    /** Stores cached messages in the database */
    static async storeMessages(): Promise<void> {
        const messages = this.instances.flatMap(cache => cache.messages.store);
        const messagesToInsert = messages.map((data, messageId) => {
            const croppedContent = data.content ? elipsify(data.content, 1024) : null;

            return `(
                ${messageId}, 
                ${data.author_id}, 
                ${data.channel_id}, 
                ${data.guild_id}, 
                ${data.created_at},
                ${sanitizeString(croppedContent)},
                ${data.reference_id},
                ${data.category_id},
                ${data.sticker_id},
                ${data.deleted}
            )`;
        }).join(",");

        // If any changes need to be made, make sure the field names and values are in the exact same order
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
                    sticker_id,
                    deleted
                )
                VALUES ${messagesToInsert};
            `);
        }
    }

    /** @returns IDs of the cached messages sorted by their creation dates */
    getMessageIds(data: {
        authorId?: Snowflake,
        channelId: Snowflake,
        limit: number
    }): Snowflake[] {
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

    /** Set the content of the cached/stored message to the new message content */
    async handleEditedMessage(messageId: Snowflake, updatedContent: string): Promise<void> {
        const message = this.messages.store.get(messageId);
        const croppedContent = elipsify(updatedContent, 1024);

        if (message) {
            message.content = croppedContent;
        } else {
            await getQuery<MessageModel>(`
                UPDATE messages
                SET content = ${sanitizeString(croppedContent)}
                WHERE message_id = ${messageId};
            `);
        }
    }

    /**
     * Set the `deleted` field of the cached/stored message to `true`
     * @returns The cached/stored message and its reference (if `true` is passed to `fetchReference`)
     */
    async handleDeletedMessage(messageId: Snowflake, fetchReference: boolean): Promise<Record<"message" | "reference", MessageModel | null>> {
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
            reference = await this.fetchMessage(message.reference_id);
        }

        return { message, reference };
    }

    fetchMessage(messageId: Snowflake): Promise<MessageModel | null> {
        const cachedMessage = this.messages.store.get(messageId);
        if (cachedMessage) return Promise.resolve(cachedMessage);

        return getQuery<MessageModel>(`
            SELECT *
            FROM messages
            WHERE message_id = ${messageId};
        `);
    }

    /**
     * Set the `deleted` field of the cached/stored message(s) to `true`
     * @returns The cached/stored messages
     */
    async handleBulkDeletedMessages(messageIds: Snowflake[]): Promise<MessageModel[]> {
        const uncachedMessages: Snowflake[] = [];
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
                SET deleted = true
                WHERE message_id IN (${uncachedMessages.join(",")})
                RETURNING *;
            `);

            messages = messages.concat(storedMessages);
        }

        return messages;
    }
}