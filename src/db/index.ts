import { Database } from "sqlite3";
import ms from "ms";
import { Infraction, InfractionFlag, TInfraction } from "../utils/Types";

if (!process.env.DB_PATH) throw new Error("No database path provided in .env file.");
export const conn = new Database(process.env.DB_PATH);

export async function removeExpiredData() {
    await new Promise((resolve, reject) => {
        conn.run(`
            DELETE
            FROM messages
            WHERE ${Date.now()} - createdAt > ${ms("24h")}
        `, err => {
            if (err) reject(err);
            resolve(null);
        });
    });
}

export function fetchInfraction(data: { infractionId: number, guildId: string }): Promise<Infraction> {
    const { infractionId, guildId } = data;
    return new Promise((resolve, reject) => {
        conn.get(`
            SELECT *
            FROM infractions
            WHERE id = ?
              AND guildId = ?;
        `, [infractionId, guildId], (err, row: Infraction) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

export async function storeInfraction(data: {
    executorId: string;
    targetId: string;
    infractionType: TInfraction;
    guildId: string;
    requestAuthorId?: string;
    expiresAt?: number | null;
    flag?: InfractionFlag;
    reason?: string | null;
}) {
    const { guildId, executorId, targetId, infractionType, requestAuthorId, expiresAt, flag, reason } = data;

    // @formatter:off
    await new Promise((resolve, reject) => {
        conn.run(`
            INSERT INTO infractions (
                guildId,
                executorId,
                targetId,
                type,
                requestAuthorId,
                expiresAt,
                flag,
                reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       `, [
            guildId,
            executorId,
            targetId,
            infractionType,
            requestAuthorId || null,
            expiresAt || null,
            flag || null,
            reason?.toString() || null
        ], err => {
            if (err) reject(err);
            resolve(null);
        });
    });
}