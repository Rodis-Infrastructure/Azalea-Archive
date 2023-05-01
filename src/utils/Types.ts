import { EmbedBuilder, GuildTextBasedChannel } from "discord.js";

export enum InteractionResponseType {
    Default = 0,
    Defer = 1,
    EphemeralDefer = 2,
}

export enum LoggingEvent {
    InteractionUsage = "interactionUsage",
    MemberKick = "memberKick",
    MemberBan = "memberBan",
}

export type StringInteractionType = "buttons" | "modals" | "selections";

type PermissionData = Record<StringInteractionType, string[] | undefined> & Record<"guildStaff", boolean | undefined>;
type LoggingEventData =
    ToggleableProperty
    & Record<LoggingEvent, ToggleableProperty & Record<"channelId", string> | undefined>

interface ToggleableProperty {
    enabled: boolean
    excludedChannels?: string[]
    excludedCategories?: string[]
}

type EmojiType = "success" | "error";

export interface ConfigData {
    deleteMessageSecondsOnBan?: number
    ephemeralResponses?: ToggleableProperty
    roles?: Array<PermissionData & Record<"id", string>>,
    groups?: Array<PermissionData & Record<"roles", string[]>>,
    logging?: LoggingEventData,
    emojis?: Partial<Record<EmojiType, string>>
}

export type LogData = {
    event: LoggingEvent,
    embed: EmbedBuilder
} & (
    { channel: GuildTextBasedChannel, guildId?: never } |
    { channel?: never, guildId: string }
);