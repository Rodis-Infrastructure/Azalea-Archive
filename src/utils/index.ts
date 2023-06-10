import { InfractionFlag, InteractionCustomIdFilter, TInfraction } from "./Types";
import { Collection } from "discord.js";

import Button from "../handlers/interactions/buttons/Button";
import Modal from "../handlers/interactions/modals/Modal";
import SelectMenu from "../handlers/interactions/select_menus/SelectMenu";

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
        .join(" ");
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