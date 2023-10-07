import { InfractionFlag, InfractionModel, MessageModel, PunishmentType } from "../types/db";
import { sanitizeString } from "../utils";
import { Message } from "discord.js";
import { Database } from "sqlite3";

import * as process from "process";
import Cache from "../utils/cache";

if (!process.env.DB_PATH) throw new Error("No database path provided (DB_PATH)");
const connection = new Database(process.env.DB_PATH);

/** Runs a query that doesn't return anything */
export function runQuery(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
        connection.run(query, err => {
            if (err) reject(err);
            resolve();
        });
    });
}

/** Runs a query that returns a single row */
export function getQuery<Result, Nullable = true>(query: string): Promise<Nullable extends false ? Result : Result | null> {
    return new Promise((resolve, reject) => {
        connection.get(query, (err, row: Result) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

/** Runs a query that returns multiple rows */
export function allQuery<Result>(query: string): Promise<Result[]> {
    return new Promise((resolve, reject) => {
        connection.all(query, (err, rows: Result[]) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

/** Stores an infraction in the database
 * @returns The infraction ID if successful, null otherwise
 */
export async function storeInfraction(data: {
    executorId: string;
    targetId: string;
    action: PunishmentType;
    guildId: string;
    requestAuthorId?: string;
    expiresAt?: number | null;
    flag?: InfractionFlag;
    reason?: string | null;
}): Promise<number | null> {
    const { guildId, executorId, targetId, action, requestAuthorId, expiresAt, flag, reason } = data;

    // @formatter:off
    const infraction = await getQuery<Pick<InfractionModel, "infraction_id">>(`
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
        RETURNING infraction_id;
    `).catch(err => {
        console.error(`Failed to store infraction for ${targetId} in ${guildId}: ${err}`);
        return null;
    });

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