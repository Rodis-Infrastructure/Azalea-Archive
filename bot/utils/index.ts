import { Channel, codeBlock, GuildTextBasedChannel, Message, time } from "discord.js";
import { ExtractFuncResult, RegexPattern } from "@/types/internals";
import { ComponentCustomId, CustomId } from "@/types/interactions";
import { MessageModel } from "@database/models/message";
import { TimestampStyles } from "@discordjs/formatters";

import Cache from "./cache";

export function capitalize(str: string): string {
    return str[0].toUpperCase() + str.slice(1);
}

export function msToString(timestamp: number): string {
    const units = [
        { unit: "day", value: 24 * 60 * 60 * 1000 },
        { unit: "hour", value: 60 * 60 * 1000 },
        { unit: "minute", value: 60 * 1000 }
    ];

    return units
        .map(({ unit, value }) => {
            const count = Math.floor(timestamp / value);
            timestamp %= value;
            return count && `${count} ${pluralize(unit, count)}`;
        })
        .filter(Boolean)
        .join(" ") || "< 1 minute";
}

export function elipsify(str: string, length: number): string {
    const maxLength = length - 25;
    const newStr = str.slice(0, maxLength);
    return str.length > length
        ? `${newStr}...(${str.length - newStr.length} more characters)`
        : str;
}

export function isGuildTextBasedChannel(channel: Channel): channel is GuildTextBasedChannel {
    return channel.isTextBased() && !channel.isDMBased();
}

export function formatReason(reason: string | null | undefined): string {
    return reason ? ` (\`${reason.replaceAll("`", "")}\`)` : "";
}

export function formatMuteExpirationResponse<T extends EpochTimeStamp>(expiresAt: T): `<t:${T}:F> | Expires <t:${T}:R>` {
    const expiresAtDateTimestamp = time(expiresAt, TimestampStyles.LongDateTime);
    const expiresAtRelativeTimestamp = time(expiresAt, TimestampStyles.RelativeTime);

    return `${expiresAtDateTimestamp} | Expires ${expiresAtRelativeTimestamp}`;
}

/** Current epoch timestamp in seconds */
export function currentTimestamp(): EpochTimeStamp {
    return Math.floor(Date.now() / 1000);
}

export function pluralize(str: string, count: number): string {
    return count === 1 ? str : `${str}s`;
}

export function getCustomId(customId: ComponentCustomId): CustomId {
    return typeof customId === "string"
        ? customId
        : Object.values(customId)[0];
}

/** Maximum mute duration in milliseconds (28 days) */
export const MAX_MUTE_DURATION = 86_400_000;

export const RegexPatterns = {
    /**
     * Only allow the duration to be given in days, hours, and minutes
     *
     * ## Allowed Formats
     * - 2 days, 2days, 1 day, 1 days, 1 d, 1d
     * - 2 hours, 2 hrs, 2hours, 2hrs, 1 hour, 1 hr, 1hour, 1hr, 1 h, 1h
     * - 2 minutes, 2 mins, 2minutes, 2mins, 1 minute, 1 min, 1 m, 1m
     */
    DurationValidation: {
        pattern: /^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi,
        returnedFields: [] as const
    },
    /**
     * Enforce a specific format for ban/mute requests
     *
     * ## Allowed Formats
     * - **User mention**: <@userId>, <@!userId>, or simply userId
     * - **Duration**: 2h, 2h, 2m (only applicable to temporary infractions)
     * - **Reason**: Any text after the user mention, or duration if included
     *
     * ## Example
     * <@000000000000000000> 2h Spamming.
     *
     * - **targetId**: 000000000000000000
     * - **duration**: 2h
     * - **reason**: Spamming.
     */
    RequestValidation: {
        pattern: /^(?:<@!?)?(?<targetId>\d{17,19})>? ?(?<duration>\d{1,3}[mhd])? (?<reason>(?:.|[\n\r])+)/gmi,
        returnedFields: ["targetId", "duration", "reason"] as const
    },
    /**
     * Extract the channel ID from a message link
     *
     * ## Example
     * 111111111111111111 would be extracted from the URL below:
     * https://discord.com/channels/000000000000000000/111111111111111111/222222222222222222/
     */
    ChannelIdFromURL: {
        pattern: /channels\/\d{17,19}\/(?<channelId>\d{17,19})\/\d{17,19}/gmi,
        returnedFields: ["channelId"]
    },
    /** Content contains a snowflake (number with 17-19 digits) */
    Snowflake: {
        pattern: /(?<id>\d{17,19})/g,
        returnedFields: ["id"] as const
    }
};

/** Serializes a message to be stored in the database */
export function serializeMessage(message: Message<true>, deleted = false): MessageModel {
    if (deleted) {
        const cache = Cache.get(message.guildId);
        const cachedMessage = cache.messages.store.get(message.id);
        if (cachedMessage) cachedMessage.deleted ||= true;
    }

    return {
        message_id: message.id,
        author_id: message.author.id,
        channel_id: message.channelId,
        content: message.content,
        guild_id: message.guildId,
        created_at: message.createdTimestamp,
        reference_id: message.reference?.messageId || null,
        category_id: message.channel.parentId,
        // There can only be one sticker per message
        sticker_id: message.stickers.first()?.id || null,
        deleted
    };
}

export function extract<T extends RegexPattern>(str: string, regex: T): ExtractFuncResult<T> {
    const res = regex.pattern.exec(str)?.groups ?? {};
    regex.pattern.lastIndex = 0;

    return res as ExtractFuncResult<T>;
}

export function ensureError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === "string") return new Error(error);

    const stringifiedError = JSON.stringify(error, null, 2);
    return new Error(`Unknown error\n${codeBlock(stringifiedError)}`);
}