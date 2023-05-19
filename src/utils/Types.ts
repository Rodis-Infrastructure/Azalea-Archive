import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildTextBasedChannel,
    MessageContextMenuCommandInteraction,
    User,
    UserContextMenuCommandInteraction
} from "discord.js";

import ChatInputCommand from "../handlers/interactions/commands/ChatInputCommand";
import ContextMenuCommand from "../handlers/interactions/commands/ContextMenuCommand";

export type InteractionCustomIdFilter = string | { startsWith: string } | { endsWith: string } | { includes: string };

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
    InteractionUsage = "interactionUsage",
    Infraction = "infractions",
    Message = "messages"
}

export enum InfractionType {
    Ban = "Member Banned",
    Unban = "Member Unbanned",
    Kick = "Member Kicked",
    Mute = "Member Muted",
    Unmute = "Member Unmuted"
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
    reason?: string | null
} & (
    { infractionType: InfractionType.Mute, duration: number } |
    { infractionType: Exclude<InfractionType, InfractionType.Mute>, duration?: never }
);

export type LogData = {
    event: LoggingEvent,
    embed: EmbedBuilder
} & (
    { channel: GuildTextBasedChannel, guildId?: never } |
    { channel?: never, guildId: string }
);

export interface CustomComponentProperties {
    name: InteractionCustomIdFilter;
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
}

export enum CacheType {
    Messages = "messages"
}

export interface Cache {
    messages: {
        store: CachedMessage[];
        remove: string[];
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