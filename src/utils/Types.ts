import {ColorResolvable} from "discord.js";

export type StringInteractionType = "slash_commands" | "message_commands" | "user_commands" | "buttons" | "modals" | "select_menus"; 

type ChannelToggleableFeatureData = {
    enabled?: boolean,
    excluded_channels?: string[],
    excluded_categories?: string[]
}

type RoleProperties = {
    id?: string,
    slash_commands?: string[],
    message_commands?: string[],
    user_commands?: string[],
    select_menus?: string[],
    buttons?: string[],
    modals?: string[]
}

type LoggingEventData = ChannelToggleableFeatureData & {
    channel_id?: string
}

export type GuildConfig = {
    colors?: {
        default?: ColorResolvable
    }
    force_ephemeral_response?: ChannelToggleableFeatureData,
    roles?: { [key: string]: RoleProperties },
    logging?: {
        excluded_channels?: string[],
        excluded_categories?: string[],
        command_usage?: LoggingEventData
    }
}

export enum InteractionResponseType {
    Defer = 0,
    EphemeralDefer = 1,
    Default = 2
}