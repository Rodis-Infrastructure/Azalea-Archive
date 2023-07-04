import { Collection, GuildTextBasedChannel, MessageCreateOptions, MessagePayload, User } from "discord.js";

import { InfractionFlag, MinimalInfraction } from "../db/db.types";

export enum RolePermission {
    Button = "buttons",
    Modal = "modals",
    SelectMenu = "selections",
    Reaction = "reactions",
}

export enum LoggingEvent {
    Interaction = "interactions",
    Infraction = "infractions",
    Message = "messages"
}

export enum InfractionType {
    Ban = "Member Banned",
    Unban = "Member Unbanned",
    Kick = "Member Kicked",
    Mute = "Member Muted",
    Unmute = "Member Unmuted",
    Note = "Note Added",
}

export interface PermissionData extends Partial<Record<RolePermission, string[]>> {
    guildStaff?: boolean
    manageInfractions?: boolean
    viewModerationActivity?: boolean
}

type LoggingData =
    ToggleableProperty
    & Record<LoggingEvent, ToggleableProperty & Record<"channelId", string> | undefined>

interface ToggleableProperty {
    enabled: boolean
    excludedChannels?: string[]
    excludedCategories?: string[]
}

interface EmojiData {
    success: string | "✅"
    error: string | "❌"
    quickMute30?: string
    quickMute60?: string
    purgeMessages?: string
}

export enum InfractionFilter {
    All = "All",
    Automatic = "Automatic",
    Deleted = "Deleted",
}

export interface ConfigData {
    deleteMessageSecondsOnBan?: number
    confirmationChannel?: string
    ephemeralResponses?: ToggleableProperty
    roles?: Array<PermissionData & Record<"id", string>>
    groups?: Array<PermissionData & Record<"roleIds", string[]>>
    logging?: LoggingData
    emojis?: EmojiData
    userFlags?: UserFlag[]
}

interface UserFlag {
    name: string;
    roleIds: string[];
}

export type InfractionData = {
    moderator: User,
    offender: User,
    guildId: string,
    requestAuthor?: User,
    flag?: InfractionFlag,
    reason?: string | null
} & (
    { infractionType: InfractionType.Mute, duration: number } |
    { infractionType: Exclude<InfractionType, InfractionType.Mute>, duration?: never }
);

export type LogData = {
    event: LoggingEvent,
    options: string | MessagePayload | MessageCreateOptions
} & (
    { channel: GuildTextBasedChannel, guildId?: never } |
    { channel?: never, guildId: string }
);

export interface Cache {
    messages: {
        store: Collection<string, CachedMessage>;
        remove: Set<string>;
        purged?: {
            targetId?: string;
            moderatorId: string;
            data: string[];
        }
    }
    activeMutes: Collection<string, number>;
    infractions: Collection<string, CachedInfractions>;
}

export interface CachedInfractions {
    messages: Collection<string, CachedInfractionSearchMessage>;
    data: MinimalInfraction[];
    timeout?: NodeJS.Timeout;
}

interface CachedInfractionSearchMessage {
    filter: InfractionFilter | null;
    authorId: string;
    page: number;
}

export interface CachedMessage {
    authorId: string;
    channelId: string;
    guildId: string;
    createdAt: number;
}