import ChatInputCommand from "../handlers/interactions/commands/chatInputCommand";
import ContextMenuCommand from "../handlers/interactions/commands/contextMenuCommand";
import {
    ChatInputCommandInteraction,
    MessageContextMenuCommandInteraction,
    UserContextMenuCommandInteraction
} from "discord.js";

export type InteractionCustomIdFilter = string | { startsWith: string } | { endsWith: string } | { includes: string };

export enum InfractionSubcommand {
    Info = "info",
    Search = "search",
    Delete = "delete",
    Reason = "reason",
    Duration = "duration",
}

export enum InteractionResponseType {
    Default = 0,
    Defer = 1,
    DeferUpdate = 2,
}

export interface CustomComponentProperties {
    name: InteractionCustomIdFilter;
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    ephemeral?: boolean;
}

export enum PurgeSubcommand {
    User = "user",
    All = "all"
}

export type Command = ChatInputCommand | ContextMenuCommand;
export type CommandInteraction =
    ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction;