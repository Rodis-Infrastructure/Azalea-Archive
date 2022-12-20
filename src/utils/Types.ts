import {ColorResolvable} from "discord.js";

export type LogIcon = "InteractionIcon";
export type StringCommandType = "slashCommands" | "messageCommands" | "userCommands";
export type StringInteractionType = StringCommandType | "buttons" | "modals" | "selectMenus";

type ChannelToggleableFeatureData = {
    isEnabled?: boolean,
    excludedChannels?: string[],
    excludedCategories?: string[]
}

type RolePermissionProperties = {
    roleId?: string,
    slashCommands?: string[],
    messageCommands?: string[],
    userCommands?: string[],
    selectMenus?: string[],
    buttons?: string[],
    modals?: string[]
}

type LoggingEventData = ChannelToggleableFeatureData & {
    embedColor?: ColorResolvable,
    channelId?: string
}

export type GuildConfig = {
    colors?: {
        embedDefault?: ColorResolvable
    }
    forceEphemeralResponse?: ChannelToggleableFeatureData,
    rolePermissions?: { [key: string]: RolePermissionProperties },
    logging?: {
        excludedChannels?: string[],
        excludedCategories?: string[],
        interactionUsage?: LoggingEventData
    }
}

export enum InteractionResponseType {
    Defer = 0,
    EphemeralDefer = 1,
    Default = 2
}