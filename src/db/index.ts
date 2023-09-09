import { Infraction, InfractionFlag, InfractionPunishment } from "../types/db";
import { stringify } from "../utils";
import { Database } from "sqlite3";

import ClientManager from "../client";
import * as process from "process";

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
    action: InfractionPunishment;
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
            ${stringify(reason)}
        )
        RETURNING infraction_id, created_at;
    `);

    // @formatter:on
    if (infraction) {
        if (action === InfractionPunishment.Mute) ClientManager.cache.activeMutes.set(targetId, infraction.infraction_id);
        const { data: infractions } = ClientManager.cache.infractions.get(targetId) || {};

        infractions?.push({
            infraction_id: infraction.infraction_id,
            executor_id: executorId,
            action: action,
            expires_at: expiresAt || undefined,
            created_at: infraction.created_at,
            deleted_at: undefined,
            deleted_by: undefined,
            reason: reason || undefined,
            flag
        });
    }

    return infraction?.infraction_id || null;
}