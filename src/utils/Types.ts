import { EmbedBuilder, GuildTextBasedChannel } from "discord.js";

enum InteractionResponseType {
    Default = 0,
    Defer = 1,
    EphemeralDefer = 2,
}

enum LoggingEvent {
    InteractionUsage = "interactionUsage",
    MemberKick = "memberKick",
}

type StringInteractionType = "buttons" | "modals" | "selectMenus";

type PermissionData = Record<StringInteractionType, string[] | undefined> & Record<"guildStaff", boolean | undefined>;
type LoggingEventData = ToggleableProperty & Record<LoggingEvent, ToggleableProperty & Record<"channelId", string> | undefined>

interface ToggleableProperty {
    enabled: boolean
    excludedChannels?: string[]
    excludedCategories?: string[]
}

type EmojiType = "success" | "error";

interface ConfigData {
    ephemeralResponses?: ToggleableProperty
    roles?: Array<PermissionData & Record<"id", string>>,
    groups?: Array<PermissionData & Record<"roles", string[]>>,
    logging?: LoggingEventData,
    emojis?: Partial<Record<EmojiType, string>>
}

type LogData = {
    event: LoggingEvent,
    embed: EmbedBuilder
} & (
    { channel: GuildTextBasedChannel, guildId?: never } |
    { channel?: never, guildId: string }
);

// Enums
export { LoggingEvent, InteractionResponseType };

// Type Declarations
export { StringInteractionType, ConfigData, LogData };
