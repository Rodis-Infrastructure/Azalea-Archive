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
    action: InfractionPunishment;
    flag?: InfractionFlag;
    reason?: string;
}

export interface InfractionCount {
    note: number;
    mute: number;
    kick: number;
    ban: number;
}

export enum InfractionPunishment {
    Note = 1,
    Mute = 2,
    Kick = 3,
    Ban = 4,
    Unban = 5,
    Unmute = 6
}

export enum InfractionFlag {
    Automatic = 1,
    Quick = 2,
}

export type MinimalInfraction = Omit<Infraction, "updated_by" | "updated_at" | "request_author_id" | "target_id">