import {ColorResolvable} from "discord.js";

export type StringCommandType = "slashCommands" | "messageCommands" | "userCommands";
export type StringInteractionType = StringCommandType | "buttons" | "modals" | "selectMenus";

type ChannelToggleableFeatureData = {
    isEnabled?: boolean,
    excludedChannels?: string[],
    excludedCategories?: string[]
}

type RoleProperties = {
    roleId?: string,
    slashCommands?: string[],
    messageCommands?: string[],
    userCommands?: string[],
    selectMenus?: string[],
    buttons?: string[],
    modals?: string[]
}

type LoggingEventData = ChannelToggleableFeatureData & {
    channelId?: string
}

export type GuildConfig = {
    colors?: {
        default?: ColorResolvable
    }
    forceEphemeralResponse?: ChannelToggleableFeatureData,
    roles?: { [key: string]: RoleProperties },
    logging?: {
        excludedChannels?: string[],
        excludedCategories?: string[],
        commandUsage?: LoggingEventData
    }
}

export enum InteractionResponseType {
    Defer = 0,
    EphemeralDefer = 1,
    Default = 2
}