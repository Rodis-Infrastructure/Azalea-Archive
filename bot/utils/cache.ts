import { AnyComponentInteraction, ComponentCustomId, CustomId } from "@bot/types/interactions";
import { Command, Component } from "@bot/handlers/interactions/interaction";
import { CachedRequest, MessageCache } from "@bot/types/cache";
import { MessageModel } from "@database/models/message";
import { Collection, Snowflake } from "discord.js";
import { elipsify } from "./index";
import { db } from "@database/utils.ts";

export default class Cache {
    static components = new Collection<ComponentCustomId, Component<AnyComponentInteraction<"cached">>>();
    static globalCommands = new Collection<CustomId, Command>();
    static guildCommands = new Collection<CustomId, Command>();
    private static instances = new Collection<Snowflake, Cache>();
    requests: Collection<Snowflake, CachedRequest>;
    messages: MessageCache;

    private constructor() {
        this.requests = new Collection();

        this.messages = {
            store: new Collection(),
            deletionAuditLogs: new Collection()
        };
    }

    static get(guildId: Snowflake): Cache {
        return Cache.instances.get(guildId) || Cache.create(guildId);
    }

    static create(guildId: Snowflake): Cache {
        const cache = new Cache();
        Cache.instances.set(guildId, cache);
        return cache;
    }

    static getComponent(customId: CustomId): Component<AnyComponentInteraction<"cached">> | null {
        return Cache.components.find(item => {
            const { name } = item.data;

            if (typeof name === "string") return name === customId;
            if ("startsWith" in name) return customId.startsWith(name.startsWith);
            if ("endsWith" in name) return customId.endsWith(name.endsWith);
            if ("includes" in name) return customId.includes(name.includes);

            return false;
        }) ?? null;
    }

    /** Stores cached messages in the database */
    static storeMessages(): void {
        const messages = Cache.instances
            .flatMap(cache => cache.messages.store)
            .map(data => {
                const croppedContent = data.content && elipsify(data.content, 1024);

                return {
                    $messageId: data.message_id,
                    $authorId: data.author_id,
                    $channelId: data.channel_id,
                    $guildId: data.guild_id,
                    $createdAt: data.created_at,
                    $content: croppedContent,
                    $referenceId: data.reference_id,
                    $categoryId: data.category_id,
                    $stickerId: data.sticker_id,
                    $deleted: data.deleted
                };
            });

        // If any changes need to be made, make sure the field names and values are in the exact same order
        if (messages.length) {
            const insertMessageQuery = db._db.prepare(`
                INSERT INTO messages (message_id, author_id, channel_id, guild_id, created_at, content, reference_id,
                                      category_id, sticker_id, deleted)
                VALUES ($messageId, $authorId, $channelId, $guildId, $createdAt, $content, $referenceId, $categoryId,
                        $stickerId, $deleted)
            `);

            const insertMessages = db._db.transaction(messages => {
                for (const message of messages) insertMessageQuery.run(message);
            });

            insertMessages(messages);
        }

        // Clear the cached messages
        Cache.instances.forEach(cache => cache.messages.store.clear());
    }

    /** @returns IDs of the cached messages sorted by their creation dates */
    deleteMessages(data: {
        authorId?: Snowflake,
        channelId: Snowflake,
        limit: number
    }): MessageModel[] {
        const { authorId, channelId, limit } = data;

        return this.messages.store
            .filter(message =>
                message.channel_id === channelId
                && (!authorId || message.author_id === authorId)
                && !message.deleted
            )
            .map(message => {
                message.deleted = true;
                return message;
            })
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, limit);
    }

    /** Set the content of the cached/stored message to the new message content */
    async handleEditedMessage(messageId: Snowflake, updatedContent: string): Promise<void> {
        const message = this.messages.store.get(messageId);
        const croppedContent = elipsify(updatedContent, 1024);

        if (message) {
            message.content = croppedContent;
        } else {
            await db.run(`
                UPDATE messages
                SET content = $content
                WHERE message_id = $messageId;
            `, [{
                $content: croppedContent,
                $messageId: messageId
            }]);
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
            message = await db.get<MessageModel>(`
                UPDATE messages
                SET deleted = 1
                WHERE message_id = $messageId
                RETURNING *;
            `, [{
                $messageId: messageId
            }]);
        }

        if (fetchReference && message?.reference_id) {
            reference = await this.fetchMessage(message.reference_id);
        }

        return { message, reference };
    }

    fetchMessage(messageId: Snowflake): Promise<MessageModel | null> {
        const cachedMessage = this.messages.store.get(messageId);
        if (cachedMessage) return Promise.resolve(cachedMessage);

        return db.get<MessageModel>(`
            SELECT *
            FROM messages
            WHERE message_id = $messageId;
        `, [{
            $messageId: messageId
        }]);
    }

    /**
     * Set the `deleted` field of the cached/stored message(s) to `true`
     * @returns The cached/stored messages
     */
    async handleBulkDeletedMessages(messageIds: Set<Snowflake>): Promise<Set<MessageModel>> {
        const uncachedMessages = new Set<Snowflake>();
        const messages = new Set<MessageModel>();

        for (const messageId of messageIds) {
            const cachedMessage = this.messages.store.get(messageId);

            if (!cachedMessage) {
                uncachedMessages.add(messageId);
            } else {
                messages.add(cachedMessage);
                cachedMessage.deleted = true;
                this.messages.store.set(messageId, cachedMessage);
            }
        }

        if (uncachedMessages.size) {
            const messageIdList = Array.from(uncachedMessages).join(",");
            const storedMessages = await db.all<MessageModel>(`
                UPDATE messages
                SET deleted = true
                WHERE message_id IN ($messageIds)
                RETURNING *;
            `, [{
                $messageIds: messageIdList
            }]);

            storedMessages.forEach(message => messages.add(message));
        }

        return messages;
    }
}