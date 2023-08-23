import { InfractionCount, InfractionFlag, InfractionPunishment, MinimalInfraction } from "../types/db";
import { Collection, Colors, EmbedBuilder, hyperlink, Message, userMention } from "discord.js";
import { InteractionCustomIdFilter } from "../types/interactions";
import { formatLogContent } from "./logging";
import { InfractionFilter } from "../types/utils";

import SelectMenu from "../handlers/interactions/select_menus/selectMenu";
import Button from "../handlers/interactions/buttons/button";
import Modal from "../handlers/interactions/modals/modal";

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

export function validateCustomId<T extends Button | Modal | SelectMenu>(items: Collection<InteractionCustomIdFilter, T>, customId: string): T | undefined {
    return items.find(item => {
        const { name } = item.data;

        if (typeof name === "string") return name === customId;
        if ("startsWith" in name) return customId.startsWith(name.startsWith);
        if ("endsWith" in name) return customId.endsWith(name.endsWith);
        if ("includes" in name) return customId.includes(name.includes);

        return false;
    });
}

export function formatCustomId(customId: InteractionCustomIdFilter): string {
    return typeof customId === "string"
        ? customId
        : Object.values(customId)[0];
}

export function getPunishmentType(action: InfractionPunishment) {
    switch (action) {
        case InfractionPunishment.Note:
            return "Note";
        case InfractionPunishment.Mute:
            return "Mute";
        case InfractionPunishment.Kick:
            return "Kick";
        case InfractionPunishment.Ban:
            return "Ban";
        case InfractionPunishment.Unban:
            return "Unban";
        case InfractionPunishment.Unmute:
            return "Unmute";
        default:
            return "Unknown";
    }
}

export function getPunishmentEmbedColor(action: InfractionPunishment) {
    switch (action) {
        case InfractionPunishment.Mute:
            return Colors.Orange;
        case InfractionPunishment.Kick:
            return Colors.Red;
        case InfractionPunishment.Ban:
            return Colors.Blue;
        case InfractionPunishment.Note:
            return Colors.Yellow;
        case InfractionPunishment.Unban:
        case InfractionPunishment.Unmute:
            return Colors.Green;
        default:
            return Colors.NotQuiteBlack;
    }
}

export function getInfractionFlagName(flag: InfractionFlag | number | undefined) {
    switch (flag) {
        case InfractionFlag.Automatic:
            return "Automatic";
        case InfractionFlag.Quick:
            return "Quick";
        default:
            return "";
    }
}

export function elipsify(str: string, length: number) {
    const maxLength = length - 25;
    const newStr = str.slice(0, maxLength);
    return str.length > length
        ? `${newStr}...(${str.length - newStr.length} more characters)`
        : str;
}

export function stringify(str: string | undefined | null): string | null {
    return str ? `'${str}'` : null;
}

export function formatReason(reason: string | null | undefined): string {
    return reason ? ` (\`${reason}\`)` : "";
}

export function formatTimestamp(timestamp: number | string, type: "d" | "D" | "f" | "F" | "R" | "t" | "T"): string {
    return `<t:${timestamp}:${type}>`;
}

export async function referenceLog(message: Message<true>) {
    const reference = await message.fetchReference();
    const referenceData = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setDescription(hyperlink("Jump to message", message.url))
        .setAuthor({
            name: "Reference",
            iconURL: "attachment://reply.png"
        })
        .setFields([
            {
                name: "Author",
                value: `${reference.author} (\`${reference.author.id}\`)`
            },
            {
                name: "Content",
                value: formatLogContent(reference.content)
            }
        ]);

    return {
        embed: referenceData,
        icon: {
            attachment: "./icons/reply.png",
            name: "reply.png"
        }
    };
}

export function currentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

export function mapInfractionsToFields(data: {
    infractions: MinimalInfraction[],
    filter: InfractionFilter | null,
    page: number
}): [number, {
        name: string,
        value: string
    }[]] {
    const { infractions, filter, page } = data;
    const filteredInfractions = infractions.filter(infraction => {
        switch (filter) {
            case InfractionFilter.All:
                return !infraction.deleted_at && !infraction.deleted_by;
            case InfractionFilter.Automatic:
                return infraction.flag === InfractionFlag.Automatic;
            case InfractionFilter.Deleted:
                return infraction.deleted_at && infraction.deleted_by;
            default:
                return infraction.flag !== InfractionFlag.Automatic
                    && !infraction.deleted_at
                    && !infraction.deleted_by;
        }
    });

    const fields = filteredInfractions.slice((page * 5) - 5, page * 5).map(infraction => {
        let flag = getInfractionFlagName(infraction.flag);
        flag &&= `${flag} `;

        /* Remove all URLs */
        const cleanReason = infraction.reason?.replace(/https?:\/\/.+( |$)/gi, "").trim();
        const data = [
            {
                key: "Created",
                val: formatTimestamp(infraction.created_at, "R")
            },
            {
                key: "Moderator",
                val: userMention(infraction.executor_id)
            },
            {
                key: "Reason",
                val: elipsify(cleanReason || "No reason provided", 200)
            }
        ];

        if (infraction.expires_at) {
            if (infraction.expires_at > currentTimestamp()) {
                data.splice(1, 0, {
                    key: "Expires",
                    val: formatTimestamp(infraction.expires_at, "R")
                });
            } else {
                data.splice(1, 0, {
                    key: "Duration",
                    val: msToString(infraction.expires_at - infraction.created_at)
                });
            }
        }

        return {
            name: `${flag}${getPunishmentType(infraction.action)} #${infraction.infraction_id}`,
            value: `>>> ${data.map(({ key, val }) => `\`${key}\` | ${val}`).join("\n")}`
        };
    });

    return [Math.ceil(filteredInfractions.length / 5), fields];
}

export function pluralize(str: string, count: number) {
    return count === 1 ? str : `${str}s`;
}

export function mapInfractionCount(infractions: InfractionCount) {
    return Object.entries(infractions)
        .map(([type, count]) => `\`${count ?? 0}\` ${pluralize(type[0].toUpperCase() + type.slice(1), count)}`)
        .join("\n");
}

export const MUTE_DURATION_VALIDATION_REGEX = /^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi;
export const REQUEST_VALIDATION_REGEX = /^(?:<@!?)?(?<targetId>\d{17,19})>? ?(?<duration>\d{1,3}[mhd])? (?<reason>(?:.|[\n\r])+)/gmi;
export const CHANNEL_ID_FROM_URL_REGEX = /channels\/\d{17,19}\/(\d{17,19})\/\d{17,19}/gmi;