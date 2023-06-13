import { Database } from "sqlite3";
import { InfractionFlag, TInfraction } from "../utils/Types";
import * as process from "process";
import { stringify } from "../utils";

if (!process.env.DB_PATH) throw new Error("No database path provided");
export const conn = new Database(process.env.DB_PATH);

export function runQuery(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
        conn.run(query, err => {
            if (err) reject(err);
            resolve();
        });
    });
}

export function getQuery<T>(query: string): Promise<T | null> {
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
    infractionType: TInfraction;
    guildId: string;
    requestAuthorId?: string;
    expiresAt?: number | null;
    flag?: InfractionFlag;
    reason?: string | null;
}) {
    const { guildId, executorId, targetId, infractionType, requestAuthorId, expiresAt, flag, reason } = data;

    // @formatter:off
    // Stringified parameters are optional
    await runQuery(`
        INSERT INTO infractions (
            guildId,
            executorId,
            targetId,
            type,
            requestAuthorId,
            expiresAt,
            flag,
            reason
        )
        VALUES (
            '${guildId}', 
            '${executorId}', 
            '${targetId}', 
            ${infractionType}, 
            ${stringify(requestAuthorId)},
            ${expiresAt || null}, 
            ${flag || null},
            ${stringify(reason)}
        )
    `);
}