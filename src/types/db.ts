import { Snowflake } from "discord.js";

export interface InfractionModel {
    infraction_id: number;
    target_id: Snowflake;
    request_author_id?: Snowflake;
    updated_by?: Snowflake;
    deleted_by?: Snowflake;
    deleted_at?: EpochTimeStamp;
    updated_at?: EpochTimeStamp;
    executor_id: Snowflake;
    created_at: EpochTimeStamp;
    expires_at?: EpochTimeStamp;
    action: PunishmentType;
    flag?: InfractionFlag;
    reason?: string;
}

export interface InfractionCount {
    note: number;
    mute: number;
    kick: number;
    ban: number;
}

export enum PunishmentType {
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
    message_id: Snowflake;
    author_id: Snowflake;
    channel_id: Snowflake;
    guild_id: Snowflake;
    created_at: EpochTimeStamp;
    deleted: boolean;
    reference_id: Snowflake | null;
    category_id: Snowflake | null;
    content: string | null;
}

export type MinimalInfraction = Omit<InfractionModel, "updated_by" | "updated_at" | "request_author_id" | "target_id">