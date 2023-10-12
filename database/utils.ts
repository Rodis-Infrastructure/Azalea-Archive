import { InfractionFlag, InfractionModel, PunishmentType } from "./models/infraction";
import { Database } from "sqlite3";

if (!process.env.DB_PATH) throw new Error("No database path provided (DB_PATH)");
const database = new Database(process.env.DB_PATH);

/** Runs a query that doesn't return anything */
export function runQuery(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
        database.run(query, err => {
            if (err) reject(err);
            resolve();
        });
    });
}

/** Runs a query that returns a single row */
export function getQuery<Result, Nullable = true>(query: string): Promise<Nullable extends false ? Result : Result | null> {
    return new Promise((resolve, reject) => {
        database.get(query, (err, row: Result) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

/** Runs a query that returns multiple rows */
export function allQuery<Result>(query: string): Promise<Result[]> {
    return new Promise((resolve, reject) => {
        database.all(query, (err, rows: Result[]) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

/** Sanitizes a string for use in a SQL query */
export function sanitizeString(str: string | undefined | null): string | null {
    return str ? `'${str.replaceAll("'", "''")}'` : null;
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