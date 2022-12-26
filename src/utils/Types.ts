import {ColorResolvable, Interaction} from "discord.js";

enum InteractionResponseType {
    Default = 0,
    Defer = 1,
    EphemeralDefer = 2,
}

enum Icon {
    Interaction = "InteractionIcon"
}

enum LogType {
    interactionUsage = "Interaction Used"
}

type StringCommandType = "slashCommands" | "messageCommands" | "userCommands";
type StringInteractionType = StringCommandType | "buttons" | "modals" | "selectMenus";

type ToggleablePropertyData = Partial<{
    isEnabled: boolean,
    excludedChannels: string[],
    excludedCategories: string[]
}>

type RolePermissionData = Partial<{
    roleId: string,
    slashCommands: string[],
    messageCommands: string[],
    userCommands: string[],
    selectMenus: string[],
    buttons: string[],
    modals: string[]
}>

type LoggingEventData = ToggleablePropertyData & Partial<{
    embedColor: ColorResolvable,
    channelId: string
}>

type GuildConfig = Partial<{
    colors: {
        embedDefault: ColorResolvable
    }
    forceEphemeralResponse: ToggleablePropertyData,
    rolePermissions: { [key: string]: RolePermissionData },
    logging: ToggleablePropertyData & {
        interactionUsage: LoggingEventData
    }
}>

interface LogData {
    type: LogType,
    interaction: Interaction,
    icon: Icon,
    config: GuildConfig | undefined,
    content?: string,
    fields?: {
        name: string,
        value: string
    }[]
}

// Enums
export {Icon, LogType, InteractionResponseType}

// Type Declarations
export {StringCommandType, StringInteractionType, GuildConfig, LogData}