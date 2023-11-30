import {
    ApplicationCommandData,
    ApplicationCommandType,
    CacheType,
    MessageComponentInteraction,
    ModalSubmitInteraction
} from "discord.js";

/** Custom ID of an interaction */
export type CustomId = string;
export type ComponentCustomId = string | { startsWith: string } | { endsWith: string } | { includes: string };

export enum InfractionSubcommand {
    Info = "info",
    Search = "search",
    Archive = "archive",
    Reason = "reason",
    Duration = "duration",
}

export enum InteractionResponseType {
    /** Don't defer the interaction (respond using `.reply()` or `.update()`) */
    Default = "default",
    /** Defer the interaction response (respond using `.editReply()`) */
    Defer = "defer",
    /** Defer the interaction's message edit (edit message using `.editReply()`) */
    DeferUpdate = "deferUpdate",
}

type BaseInteractionData = {
    skipEphemeralCheck: boolean;
} & ({
    defer: InteractionResponseType.Default;
    ephemeral?: never;
} | {
    defer: Exclude<InteractionResponseType, InteractionResponseType.Default>;
    ephemeral?: boolean;
});

export type ComponentData = BaseInteractionData & Record<"name", ComponentCustomId>;
export type CommandData = ApplicationCommandData & BaseInteractionData & Record<"type", ApplicationCommandType>

export type AnyComponentInteraction<Cached extends CacheType = CacheType> =
    MessageComponentInteraction<Cached>
    | ModalSubmitInteraction<Cached>;