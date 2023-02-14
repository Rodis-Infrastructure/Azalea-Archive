enum InteractionResponseType {
    Default = 0,
    Defer = 1,
    EphemeralDefer = 2,
}

enum LoggingEvent {
    InteractionUsage = "interactionUsage"
}

type StringInteractionType = "buttons" | "modals" | "selections";

type ToggleablePropertyData = Partial<{
    enabled: boolean
    excludedChannels: string[]
    excludedCategories: string[]
}>

type LoggingEventData = ToggleablePropertyData & Partial<{
    channelId: string
}>

type LoggingData = ToggleablePropertyData & Partial<{
    interactionUsage: LoggingEventData
}>

type InteractionPermissions = Partial<{
    buttons: string[]
    modals: string[]
    selections: string[]
}>

type PermissionData = Partial<{
    roles: Record<string, InteractionPermissions>
    groups: Record<string, InteractionPermissions & Record<"roles", string[]>>
}>

type ConfigData = Partial<{
    ephemeralResponses: ToggleablePropertyData
    permissions: PermissionData
    logging: LoggingData
}>

// Enums
export { LoggingEvent, InteractionResponseType };

// Type Declarations
export {
    StringInteractionType,
    ConfigData,
    LoggingData,
    ToggleablePropertyData,
    PermissionData
};
