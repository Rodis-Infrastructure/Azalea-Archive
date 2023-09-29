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
    action: InfractionType;
    flag?: InfractionFlag;
    reason?: string;
}

export interface InfractionCount {
    note: number;
    mute: number;
    kick: number;
    ban: number;
}

export enum InfractionType {
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

export interface MessageModel {
    message_id: string;
    author_id: string;
    channel_id: string;
    guild_id: string;
    created_at: number;
    deleted: boolean;
    reference_id: string | null;
    category_id: string | null;
    content: string | null;
}

export type MinimalInfraction = Omit<Infraction, "updated_by" | "updated_at" | "request_author_id" | "target_id">