export interface Infraction {
    infraction_id: number;
    target_id: string;
    request_author_id?: string;
    updated_by?: string;
    deleted_by?: string;
    deleted_at?: number;
    updated_at?: number;
    executor_id: string;
    created_at: number;
    expires_at?: number;
    action: InfractionAction;
    flag?: InfractionFlag;
    reason?: string;
}

export interface InfractionCount {
    note: number;
    mute: number;
    kick: number;
    ban: number;
}

export enum InfractionAction {
    Note = 1,
    Mute = 2,
    Kick = 3,
    Ban = 4,
    Unban = 5
}

export enum InfractionFlag {
    Automatic = 1,
    Quick = 2,
}

export type MinimalInfraction = Pick<Infraction, "infraction_id" | "created_at" | "reason" | "executor_id" | "flag" | "deleted_at" | "deleted_by" | "expires_at" | "action">;