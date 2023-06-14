import { InfractionFlag, InteractionCustomIdFilter, TInfraction } from "./Types";
import { Collection, Colors, EmbedBuilder, Message } from "discord.js";

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
            return count && `${count} ${unit}${count > 1 ? "s" : ""}`;
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

export function getInfractionFlagName(infractionFlag: InfractionFlag) {
    switch (infractionFlag) {
        case InfractionFlag.Automatic:
            return "Automatic";
        case InfractionFlag.Quick:
            return "Quick Mute";
        default:
            return "Unknown";
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

export const DURATION_FORMAT_REGEX = /^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi;