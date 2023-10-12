import { Snowflake } from "discord.js";

import { CustomId } from "./interactions";

interface UserFlag {
    name: string;
    roleIds: Snowflake[];
}

export enum LoggingEvent {
    Interaction = "interactions",
    Infraction = "infractions",
    Message = "messages",
    Media = "media",
    Voice = "voice",
    Thread = "threads",
}

export enum RolePermission {
    GuildStaff = "guildStaff",
    ManageInfractions = "manageInfractions",
    ViewModerationActivity = "viewModerationActivity",
    ManageBanRequests = "manageBanRequests",
    ManageMuteRequests = "manageMuteRequests",
    AutoMuteBanRequests = "autoMuteBanRequests"
}

export enum RoleInteraction {
    Button = "buttons",
    Modal = "modals",
    SelectMenu = "selectMenus",
    Reaction = "reactions"
}

export type RolePermissions =
    Record<RoleInteraction, CustomId[] | undefined>
    & Record<RolePermission, boolean | undefined>
    & Record<"roleIds", Snowflake[]>

export interface ToggleableProperty {
    enabled: boolean
    excludedChannels?: Snowflake[]
    excludedCategories?: Snowflake[]
}

export interface NotificationOptions {
    allowMentions?: boolean,
    sourceChannelId?: Snowflake
}

export interface ConfirmationOptions {
    executorId: Snowflake,
    success: boolean,
    reason?: string
}

export interface EmojiConfig {
    success: string
    error: string
    quickMute30?: string
    quickMute60?: string
    purgeMessages?: string
    approveRequest?: string
    denyRequest?: string
}

export interface NoticeConfig {
    enabled: boolean
    channelId: Snowflake
    /** The number of unreviewed requests to trigger a notice */
    threshold: number
    /** The number of milliseconds between notices */
    interval: number
    mentionedRoles?: Snowflake[]
}

export interface ChannelConfig {
    banRequestQueue?: Snowflake
    muteRequestQueue?: Snowflake
    mediaConversion?: Snowflake
    notifications?: Snowflake
}

export type LoggingConfig = ToggleableProperty & {
    [event in LoggingEvent]?: ToggleableProperty & {
        channelId: Snowflake
    }
};

export interface AutoReactionConfig {
    channelId: Snowflake
    reactions: string[]
}

export interface Notices {
    banRequests?: NoticeConfig
    muteRequests?: NoticeConfig
}

export interface ConfigData {
    autoReactions?: AutoReactionConfig[]
    deleteMessageSecondsOnBan?: number
    proofChannelIds?: Snowflake[]
    notices?: Notices
    ephemeralResponses?: ToggleableProperty
    permissions?: RolePermissions[]
    logging?: LoggingConfig
    emojis?: EmojiConfig
    userFlags?: UserFlag[]
    channels?: ChannelConfig
    guildId: Snowflake
}