import { MessageCreateOptions, MessagePayload, User } from "discord.js";
import { InfractionFlag, InfractionPunishment } from "./db";
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

export type InfractionData = {
    executor: User,
    targetId: string,
    guildId: string,
    requestAuthor?: User,
    flag?: InfractionFlag,
    reason?: string | null
} & (
    {
        punishment: InfractionPunishment.Mute,
        duration: number
    } |
    {
        punishment: Exclude<InfractionPunishment, InfractionPunishment.Mute>,
        duration?: never
    }
);

export type LogData = {
    event: LoggingEvent,
    options: string | MessagePayload | MessageCreateOptions,
    guildId: string
} & ({
    channelId: string,
    categoryId?: string | null
} | {
    channelId?: never,
    categoryId?: never
})