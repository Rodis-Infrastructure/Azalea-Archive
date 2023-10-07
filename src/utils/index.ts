import { Channel, GuildTextBasedChannel } from "discord.js";
import { ComponentCustomId } from "../types/interactions";
import { CustomId } from "../types/utils";

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

/** Sanitizes a string for use in a SQL query */
export function sanitizeString(str: string | undefined | null): string | null {
    return str ? `'${str.replaceAll("'", "''")}'` : null;
}

export function isGuildTextBasedChannel(channel: Channel): channel is GuildTextBasedChannel {
    return channel.isTextBased() && !channel.isDMBased();
}

export function formatReason(reason: string | null | undefined): string {
    return reason ? ` (\`${reason.replaceAll("`", "")}\`)` : "";
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
    DurationValidation: /^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi,
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
    RequestValidation: /^(?:<@!?)?(?<targetId>\d{17,19})>? ?(?<duration>\d{1,3}[mhd])? (?<reason>(?:.|[\n\r])+)/gmi,
    /**
     * Extract the channel ID from a message link
     *
     * ## Example
     * 111111111111111111 would be extracted from the URL below:
     * https://discord.com/channels/000000000000000000/111111111111111111/222222222222222222/
     */
    ChannelIdFromURL: /channels\/\d{17,19}\/(\d{17,19})\/\d{17,19}/gmi
};