enum InteractionResponseType {
    Default = 0,
    Defer = 1,
    EphemeralDefer = 2,
}

enum LoggingEvent {
    InteractionUsage = "interactionUsage"
}

type StringInteractionType = "buttons" | "modals" | "selections";

type InteractionPermissions = Record<StringInteractionType, string[] | undefined>;
type LoggingEventData = ToggleableProperty & Record<LoggingEvent, ToggleableProperty & Record<"channelId", string> | undefined>

interface ToggleableProperty {
    enabled: boolean
    excludedChannels?: string[]
    excludedCategories?: string[]
}

interface PermissionData {
    roles?: Record<string, InteractionPermissions>
    groups?: Record<string, InteractionPermissions & Record<"roles", string[]>>
}

interface ConfigData {
    ephemeralResponses?: ToggleableProperty
    permissions?: PermissionData
    logging?: LoggingEventData
}

// Enums
export { LoggingEvent, InteractionResponseType };

// Type Declarations
export { StringInteractionType, ConfigData };
