import {
    AttachmentPayload,
    ColorResolvable,
    EmbedAuthorOptions,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    MessageCreateOptions,
    MessagePayload,
    Snowflake
} from "discord.js";

import { InfractionFlag, PunishmentType } from "./db";
import { LoggingEvent } from "./config";

export enum RequestType {
    Ban = "ban",
    Mute = "mute"
}

export enum InfractionFilter {
    All = "All",
    Automatic = "Automatic",
    Deleted = "Deleted",
}

export type CustomId = string;

export interface ReferenceLogData {
    embed: EmbedBuilder,
    file: AttachmentPayload
}

export interface MemberMuteResult {
    expiresAt: number,
    infractionId: number | null
}

export interface RequestValidationResult {
    target: GuildMember | null,
    reason: string
}

export interface InfractionLogData {
    color: ColorResolvable,
    author: EmbedAuthorOptions,
    file: AttachmentPayload
}

export type InfractionResolveOptions = {
    executorId: Snowflake,
    targetId: Snowflake,
    guildId: Snowflake,
    requestAuthorId?: Snowflake,
    flag?: InfractionFlag,
    reason?: string | null
} & ({
    punishment: PunishmentType.Mute,
    duration: number
} | {
    punishment: Exclude<PunishmentType, PunishmentType.Mute>,
    duration?: never
});

export type LogData = {
    event: LoggingEvent,
    options: string | MessagePayload | MessageCreateOptions
} & ({
    sourceChannel: GuildTextBasedChannel,
    guildId?: never
} | {
    sourceChannel?: never,
    guildId: string
})