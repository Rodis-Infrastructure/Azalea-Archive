import {
    AnySelectMenuInteraction,
    ApplicationCommandData,
    ApplicationCommandType,
    ButtonInteraction,
    CacheType,
    ChatInputCommandInteraction,
    MessageContextMenuCommandInteraction,
    ModalSubmitInteraction,
    UserContextMenuCommandInteraction
} from "discord.js";

export type ComponentCustomId = string | { startsWith: string } | { endsWith: string } | { includes: string };

export enum InfractionSubcommand {
    Info = "info",
    Search = "search",
    Archive = "archive",
    Reason = "reason",
    Duration = "duration",
}

export enum InteractionResponseType {
    Default = 0,
    Defer = 1,
    DeferUpdate = 2,
}

export interface ComponentData {
    name: ComponentCustomId;
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    ephemeral?: boolean;
}

export type CommandData = ApplicationCommandData & {
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    type: ApplicationCommandType;
    ephemeral?: boolean;
}

export type AnyComponentInteraction<Cached extends CacheType = CacheType> =
    ButtonInteraction<Cached>
    | ModalSubmitInteraction<Cached>
    | AnySelectMenuInteraction<Cached>;

export type AnyCommandInteraction =
    ChatInputCommandInteraction
    | UserContextMenuCommandInteraction
    | MessageContextMenuCommandInteraction;

/** Custom ID of an interaction */
export type CustomId = string;