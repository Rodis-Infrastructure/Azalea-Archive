import { APIEmbed, BaseMessageOptions, Snowflake } from "discord.js";
import { CustomId } from "./interactions";

interface UserFlag {
    /** Text to display when the flag is present */
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
    /** Exempt from being moderated */
    GuildStaff = "guildStaff",
    /** Allow modifying and archiving any infraction */
    ManageInfractions = "manageInfractions",
    /** Allow searching a staff member's infractions (dealt) */
    ViewModerationActivity = "viewModerationActivity",
    /** Allow approving and rejecting ban requests */
    ManageBanRequests = "manageBanRequests",
    /** Allow approving and rejecting mute requests */
    ManageMuteRequests = "manageMuteRequests",
    /** Automatically mute offenders ban requested by users with this permission */
    AutoMuteBanRequests = "autoMuteBanRequests",
}

export enum RoleInteraction {
    Button = "buttons",
    Modal = "modals",
    SelectMenu = "selectMenus",
    Reaction = "reactions"
}

export type RolePermissions =
    Partial<Record<RoleInteraction, CustomId[]>> &
    Partial<Record<RolePermission, boolean>> &
    Record<"roleIds", Snowflake[]>

export interface ToggleableProperty {
    enabled: boolean
    excludedChannels?: Snowflake[]
    excludedCategories?: Snowflake[]
}

export interface NotificationOptions {
    /** Whether mentioned users should be notified */
    allowMentions?: boolean,
    sourceChannelId?: Snowflake
}

export interface ConfirmationOptions {
    executorId: Snowflake,
    success: boolean,
    reason?: string
}

export interface EmojiConfig {
    success?: string
    error?: string
    quickMute30?: string
    quickMute60?: string
    purgeMessages?: string
    approveRequest?: string
    denyRequest?: string
}

export interface NoticeConfig {
    enabled: boolean
    /** The channel to send notices in */
    channelId: Snowflake
    /** The number of unreviewed requests to trigger a notice */
    threshold: number
    /** The interval for checking the number of unreviewed requests (cron syntax) */
    cron: string
    mentionedRoles?: Snowflake[]
}

export interface ChannelConfig {
    banRequestQueue?: Snowflake
    muteRequestQueue?: Snowflake
    mediaConversion?: Snowflake
    notifications?: Snowflake
}

interface FAQOption {
    /** The option's displayed name */
    name: string
    /** The option's unique ID */
    value: string
    embed: APIEmbed
}

export type LoggingConfig = ToggleableProperty & {
    [event in LoggingEvent]?: ToggleableProperty & {
        /** The channel to log to */
        channelId: Snowflake
    }
};

interface ScheduledMessage {
    channelId: string
    cron: string
    message: string | Omit<BaseMessageOptions, "components" | "files">
}

export interface AutoReaction {
    channelId: Snowflake
    reactions: string[]
}

export interface Notices {
    banRequests?: NoticeConfig
    muteRequests?: NoticeConfig
}

export interface RoleRequests {
    channelId: Snowflake
    roles: TemporaryRole[]
}

interface TemporaryRole {
    roleId: Snowflake
    /** Amount of time until the role is removed (ms) */
    duration?: number
}

export interface MediaChannel {
    channelId: Snowflake
    /** Require the user to have at least one of these roles to use the channel */
    allowedRoles?: Snowflake[]
    /** The response to send when a user without the required roles uses the channel */
    fallbackResponse?: string
}

export interface ConfigData {
    commands?: FAQOption[]
    autoReactions?: AutoReaction[]
    mediaChannels?: MediaChannel[]
    deleteMessageSecondsOnBan?: number
    scheduledMessages?: ScheduledMessage[]
    roleRequests?: RoleRequests
    /** IDs of channels that can be linked to in infraction evidence */
    proofChannelIds?: Snowflake[]
    notices?: Notices
    ephemeralResponses?: ToggleableProperty
    permissions?: RolePermissions[]
    logging?: LoggingConfig
    emojis?: EmojiConfig
    userFlags?: UserFlag[]
    channels?: ChannelConfig
}