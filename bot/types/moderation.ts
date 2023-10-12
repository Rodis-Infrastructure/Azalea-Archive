import { Message, Snowflake } from "discord.js";
import Config from "@/utils/config";

export enum QuickMuteDuration {
    /** 30 minutes */
    Short = "30m",
    /** 1 hour */
    Long = "1h",
}

export interface QuickMuteParams {
    message: Message<true>,
    duration: QuickMuteDuration,
    executorId: Snowflake,
    config: Config
}

export interface MemberMuteResult {
    expiresAt: number,
    infractionId: number | null
}