import { GuildTextBasedChannel, MessageCreateOptions, MessagePayload, User } from "discord.js";
import { InfractionFlag, InfractionPunishment } from "./db";
import { LoggingEvent } from "./config";

export enum InfractionFilter {
    All = "All",
    Automatic = "Automatic",
    Deleted = "Deleted",
}

export type InfractionData = {
    executor: User,
    target: User,
    guildId: string,
    requestAuthor?: User,
    flag?: InfractionFlag,
    reason?: string | null
} & (
    { punishment: InfractionPunishment.Mute, duration: number } |
    { punishment: Exclude<InfractionPunishment, InfractionPunishment.Mute>, duration?: never }
);

export type LogData = {
    event: LoggingEvent,
    options: string | MessagePayload | MessageCreateOptions
} & (
    { channel: GuildTextBasedChannel, guildId?: never } |
    { channel?: never, guildId: string }
);