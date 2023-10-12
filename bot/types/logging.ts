import {
    AttachmentPayload,
    CategoryChannel,
    ColorResolvable,
    EmbedAuthorOptions,
    EmbedBuilder,
    GuildBasedChannel,
    MessageCreateOptions,
    MessagePayload
} from "discord.js";

import { LoggingEvent } from "./config";

export interface ReferenceLogData {
    embed: EmbedBuilder,
    file: AttachmentPayload
}

export interface InfractionLogData {
    color: ColorResolvable,
    author: EmbedAuthorOptions,
    file: AttachmentPayload
}

export type LogData = {
    event: LoggingEvent,
    options: string | MessagePayload | MessageCreateOptions
} & ({
    sourceChannel: Exclude<GuildBasedChannel, CategoryChannel>,
    guildId?: never
} | {
    sourceChannel?: never,
    guildId: string
})