import {
    ChatInputCommandInteraction,
    Collection,
    GuildTextBasedChannel,
    MessageContextMenuCommandInteraction,
    MessageCreateOptions,
    MessagePayload,
    User,
    UserContextMenuCommandInteraction
} from "discord.js";

import ChatInputCommand from "../handlers/interactions/commands/ChatInputCommand";
import ContextMenuCommand from "../handlers/interactions/commands/ContextMenuCommand";

export type InteractionCustomIdFilter = string | { startsWith: string } | { endsWith: string } | { includes: string };

export enum InfractionSubcommand {
    Info = "info",
    Search = "search",
    Delete = "delete",
    Reason = "reason",
    Duration = "duration",
}

export enum InteractionResponseType {
    Default = 0,
    Defer = 1,
    EphemeralDefer = 2,
}

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

export enum TInfraction {
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

export interface PermissionData extends Partial<Record<RolePermission, string[]>> {
    guildStaff?: boolean
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

interface ChannelData {
    staffCommands?: string
}

export interface MinimalInfraction {
    id: number;
    executorId: bigint;
    targetId: bigint;
    createdAt: Date;
    expiresAt?: Date;
}

export interface InfractionBase {
    executorId: string;
    createdAt: number;
    expiresAt?: number;
    type: number;
    flag?: number;
    reason?: string;
}

export interface UserInfraction extends InfractionBase {
    id: number;
    targetId: string;
}

export interface Infraction extends InfractionBase {
    targetId: string;
    requestAuthorId?: string;
    updatedBy?: string;
    deletedBy?: string;
    deletedAt?: number;
    updatedAt?: number;
}

export interface ConfigData {
    deleteMessageSecondsOnBan?: number
    ephemeralResponses?: ToggleableProperty
    roles?: Array<PermissionData & Record<"id", string>>,
    groups?: Array<PermissionData & Record<"roleIds", string[]>>,
    logging?: LoggingData,
    emojis?: EmojiData,
    channels?: ChannelData
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

export interface CustomComponentProperties {
    name: InteractionCustomIdFilter;
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
}

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
}

export interface CachedMessage {
    authorId: string;
    channelId: string;
    guildId: string;
    createdAt: number;
}

export interface CustomModalProperties {
    name: InteractionCustomIdFilter;
    skipInternalUsageCheck: boolean;
    ephemeral: boolean;
}

export type Command = ChatInputCommand | ContextMenuCommand;
export type CommandInteraction =
    ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction;