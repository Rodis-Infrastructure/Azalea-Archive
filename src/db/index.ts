import { Infraction, InfractionFlag, InfractionType, MessageModel } from "../types/db";
import { sanitizeString } from "../utils";
import { Database } from "sqlite3";
import { Message } from "discord.js";

import * as process from "process";
import Cache from "../utils/cache";

if (!process.env.DB_PATH) throw new Error("No database path provided");
const conn = new Database(process.env.DB_PATH);

export function runQuery(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
        conn.run(query, err => {
            if (err) reject(err);
            resolve();
        });
    });
}

export function getQuery<T, N extends boolean = false>(query: string): Promise<N extends true ? T : T | null> {
    return new Promise((resolve, reject) => {
        conn.get(query, (err, row: T) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

export function allQuery<T>(query: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
        conn.all(query, (err, rows: T[]) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

export async function storeInfraction(data: {
    executorId: string;
    targetId: string;
    action: InfractionType;
    guildId: string;
    requestAuthorId?: string;
    expiresAt?: number | null;
    flag?: InfractionFlag;
    reason?: string | null;
}) {
    const { guildId, executorId, targetId, action, requestAuthorId, expiresAt, flag, reason } = data;

    // @formatter:off
    // Stringified parameters are optional
    const infraction = await getQuery<Pick<Infraction, "infraction_id" | "created_at">>(`
        INSERT INTO infractions (
            guild_id,
            executor_id,
            target_id,
            action,
            request_author_id,
            expires_at,
            flag,
            reason
        )
        VALUES (
            ${guildId}, 
            ${executorId}, 
            ${targetId}, 
            ${action}, 
            ${requestAuthorId || null},
            ${expiresAt || null}, 
            ${flag || null},
            ${sanitizeString(reason)}
        )
        RETURNING infraction_id, created_at;
    `);

    return infraction?.infraction_id || null;
}

/** Serializes a message to be stored in the database */
export function serializeMessage(message: Message<true>, deleted = false): MessageModel {
    if (deleted) {
        const cache = Cache.get(message.guildId);
        const cachedMessage = cache.messages.store.get(message.id);
        if (cachedMessage) cachedMessage.deleted ||= true;
    }

    return {
        message_id: message.id,
        author_id: message.author.id,
        channel_id: message.channelId,
        content: message.content,
        guild_id: message.guildId,
        created_at: message.createdTimestamp,
        reference_id: message.reference?.messageId || null,
        category_id: message.channel.parentId,
        deleted
    };
}