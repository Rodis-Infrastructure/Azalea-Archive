import { InfractionCount, InfractionFlag, InfractionType, MinimalInfraction } from "../types/db";
import { currentTimestamp, discordTimestamp, elipsify, msToString, pluralize } from "./index";
import { InfractionFilter } from "../types/utils";
import { Colors, userMention } from "discord.js";

export function getInfractionEmbedColor(action: InfractionType) {
    switch (action) {
        case InfractionType.Mute:
            return Colors.Orange;
        case InfractionType.Kick:
            return Colors.Red;
        case InfractionType.Ban:
            return Colors.Blue;
        case InfractionType.Note:
            return Colors.Yellow;
        case InfractionType.Unban:
        case InfractionType.Unmute:
            return Colors.Green;
        default:
            return Colors.NotQuiteBlack;
    }
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

    const fields = filteredInfractions.slice((page - 1) * 5, page * 5).map(infraction => {
        const flagName = infraction.flag ? `${InfractionFlag[infraction.flag]} ` : "";

        /* Remove all URLs */
        const cleanReason = infraction.reason?.replace(/https?:\/\/.+( |$)/gi, "").trim();
        const data = [
            {
                key: "Created",
                val: discordTimestamp(infraction.created_at, "R")
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
                    val: discordTimestamp(infraction.expires_at, "R")
                });
            } else {
                data.splice(1, 0, {
                    key: "Duration",
                    val: msToString(infraction.expires_at - infraction.created_at)
                });
            }
        }

        return {
            name: `${flagName}${InfractionType[infraction.action]} #${infraction.infraction_id}`,
            value: `>>> ${data.map(({ key, val }) => `\`${key}\` | ${val}`).join("\n")}`
        };
    });

    return [Math.ceil(filteredInfractions.length / 5), fields];
}

export function mapInfractionCount(infractions: InfractionCount) {
    return Object.entries(infractions)
        .map(([type, count]) => `\`${count ?? 0}\` ${pluralize(type[0].toUpperCase() + type.slice(1), count)}`)
        .join("\n");
}