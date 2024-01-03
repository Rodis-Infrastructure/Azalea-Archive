import { InfractionFlag, InfractionModel, PunishmentType } from "./models/infraction";
import { Database, SQLQueryBindings } from "bun:sqlite";

/**
 * A wrapper around the bun:sqlite {@link Database} database that provides async methods
 * and simplifies the API.
 */
class AsyncDatabase {
    _db: Database;

    constructor(path: string) {
        this._db = new Database(path, { create: true });
    }

    run(query: string, bindings: [SQLQueryBindings]): Promise<void> {
        return new Promise(resolve => {
            const stmt = this._db.prepare<void, SQLQueryBindings>(query);
            stmt.run(...bindings);
            resolve();
        });
    }

    get<ReturnType, Nullable extends boolean = true>(query: string, bindings: [SQLQueryBindings]): Promise<Nullable extends true ? ReturnType | null : ReturnType> {
        return new Promise(resolve => {
            const stmt = this._db.prepare<ReturnType, SQLQueryBindings>(query);
            resolve(stmt.get(...bindings) as ReturnType);
        });
    }

    all<ReturnType>(query: string, bindings: [SQLQueryBindings]): Promise<ReturnType[]> {
        return new Promise(resolve => {
            const stmt = this._db.prepare<ReturnType, SQLQueryBindings>(query);
            resolve(stmt.all(...bindings));
        });
    }
}

export const db = new AsyncDatabase(process.env.DB_PATH ?? "db.sqlite");

interface StoreInfractionParams {
    guildId: string;
    executorId: string;
    targetId: string;
    action: PunishmentType;
    requestAuthorId?: string | null;
    expiresAt?: number | null;
    flag?: InfractionFlag | null;
    reason?: string | null;
}

/** Stores an infraction in the database
 * @returns The infraction ID if successful, null otherwise
 */
export async function storeInfraction({
    executorId,
    targetId,
    action,
    guildId,
    requestAuthorId = null,
    expiresAt = null,
    flag = null,
    reason = null
}: StoreInfractionParams): Promise<number | null> {
    const params: [SQLQueryBindings] = [{
        $guildId: guildId,
        $executorId: executorId,
        $targetId: targetId,
        $action: action,
        $requestAuthorId: requestAuthorId,
        $expiresAt: expiresAt,
        $flag: flag,
        $reason: reason
    }];

    const infraction = await db.get<Pick<InfractionModel, "infraction_id">>(`
        INSERT INTO infractions (guild_id, executor_id, target_id, action, request_author_id, expires_at, flag, reason)
        VALUES ($guildId, $executorId, $targetId, $action, $requestAuthorId, $expiresAt, $flag, $reason)
        RETURNING infraction_id;
    `, params);

    return infraction?.infraction_id ?? null;
}