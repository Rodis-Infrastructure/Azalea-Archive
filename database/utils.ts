import {InfractionFlag, InfractionModel, PunishmentType} from "./models/infraction";
import {Database, SQLQueryBindings} from "bun:sqlite";

export const db = new Database(process.env.DB_PATH ?? "db.sqlite", {create: true});

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
export function storeInfraction({
    executorId,
    targetId,
    action,
    guildId,
    requestAuthorId = null,
    expiresAt = null,
    flag = null,
    reason = null
}: StoreInfractionParams): number | null {
    const insertInfractionQuery = db.prepare<Pick<InfractionModel, "infraction_id">, SQLQueryBindings>(`
        INSERT INTO infractions (guild_id, executor_id, target_id, action, request_author_id, expires_at, flag, reason)
        VALUES ($guildId, $executorId, $targetId, $action, $requestAuthorId, $expiresAt, $flag, $reason)
        RETURNING infraction_id;
    `);

    const infraction = insertInfractionQuery.get({
        $guildId: guildId,
        $executorId: executorId,
        $targetId: targetId,
        $action: action,
        $requestAuthorId: requestAuthorId,
        $expiresAt: expiresAt,
        $flag: flag,
        $reason: reason
    });

    return infraction?.infraction_id ?? null;
}