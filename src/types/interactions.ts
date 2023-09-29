import {
    AnySelectMenuInteraction,
    ButtonInteraction,
    ChatInputCommandInteraction,
    MessageContextMenuCommandInteraction,
    ModalSubmitInteraction,
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

export enum PurgeSubcommand {
    User = "user",
    All = "all"
}

export type AnyComponentInteraction = ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction;
export type CommandInteraction =
    ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction;