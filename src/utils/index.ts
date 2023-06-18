import {
    InfractionCount,
    InfractionFilter,
    InfractionFlag,
    InteractionCustomIdFilter,
    MinimalInfraction,
    TInfraction
} from "./Types";
import { Collection, Colors, EmbedBuilder, Message, userMention } from "discord.js";

import Button from "../handlers/interactions/buttons/Button";
import Modal from "../handlers/interactions/modals/Modal";
import SelectMenu from "../handlers/interactions/select_menus/SelectMenu";
import { formatLogContent } from "./LoggingUtils";

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

export function getInfractionName(infractionType: TInfraction) {
    switch (infractionType) {
        case TInfraction.Note:
            return "Note";
        case TInfraction.Mute:
            return "Mute";
        case TInfraction.Kick:
            return "Kick";
        case TInfraction.Ban:
            return "Ban";
        case TInfraction.Unban:
            return "Unban";
        default:
            return "Unknown";
    }
}

export function getInfractionColor(infractionType: TInfraction) {
    switch (infractionType) {
        case TInfraction.Mute:
            return Colors.Orange;
        case TInfraction.Kick:
            return Colors.Red;
        case TInfraction.Ban:
            return Colors.Blue;
        case TInfraction.Note:
            return Colors.Yellow;
        case TInfraction.Unban:
            return Colors.Green;
        default:
            return Colors.NotQuiteBlack;
    }
}

export function getInfractionFlagName(infractionFlag: InfractionFlag | number | undefined) {
    switch (infractionFlag) {
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

export async function referenceLog(message: Message) {
    const reference = await message.fetchReference();
    const referenceData = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setAuthor({
            name: "Reference",
            iconURL: "attachment://reply.png",
            url: reference.url
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
}): [number, { name: string, value: string }[]] {
    const { infractions, filter, page } = data;
    const filteredInfractions = infractions.filter(infraction => {
        switch (filter) {
            case InfractionFilter.All:
                return !infraction.deletedAt && !infraction.deletedBy;
            case InfractionFilter.Automatic:
                return infraction.flag === InfractionFlag.Automatic;
            case InfractionFilter.Deleted:
                return infraction.deletedAt && infraction.deletedBy;
            default:
                return infraction.flag !== InfractionFlag.Automatic
                    && !infraction.deletedAt
                    && !infraction.deletedBy;
        }
    });

    const fields = filteredInfractions.slice((page * 5) - 5, page * 5).map(infraction => {
        let flag = getInfractionFlagName(infraction.flag);
        flag &&= `${flag} `;

        const data = [
            {
                key: "Created",
                val: formatTimestamp(infraction.createdAt, "R")
            },
            {
                key: "Moderator",
                val: userMention(infraction.executorId)
            },
            {
                key: "Reason",
                val: elipsify(infraction.reason || "No reason provided", 200)
            }
        ];

        if (infraction.expiresAt) {
            if (infraction.expiresAt > currentTimestamp()) {
                data.splice(1, 0, {
                    key: "Expires",
                    val: formatTimestamp(infraction.expiresAt, "R")
                });
            } else {
                data.splice(1, 0, {
                    key: "Duration",
                    val: msToString(infraction.expiresAt - infraction.createdAt)
                });
            }
        }

        return {
            name: `${flag}${getInfractionName(infraction.type)} #${infraction.id}`,
            value: data.map(({ key, val }) => `\`${key}\` | ${val}`).join("\n")
        };
    });

    return [Math.ceil(filteredInfractions.length / 5), fields];
}

export function pluralize(str: string, count: number) {
    return count === 1 ? str : `${str}s`;
}

export function mapInfractionCount(infractions: InfractionCount) {
    return Object.entries(infractions)
        .map(([type, count]) => `\`${count}\` ${pluralize(type[0].toUpperCase() + type.slice(1), count)}`)
        .join("\n");
}

export const DURATION_FORMAT_REGEX = /^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi;