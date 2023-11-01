import {
    InfractionCount,
    InfractionFilter,
    InfractionFlag,
    MinimalInfraction,
    PunishmentType
} from "@database/models/infraction";

import { capitalize, currentTimestamp, elipsify, msToString, pluralize } from "./index";
import { ColorResolvable, Colors, time, userMention } from "discord.js";
import { TimestampStyles } from "@discordjs/formatters";
import { APIEmbedField } from "discord-api-types/v10";
import { InfractionLogData } from "@bot/types/logging";

export function getInfractionEmbedData(punishment: PunishmentType): InfractionLogData {
    let color: ColorResolvable = Colors.NotQuiteBlack;
    let action = "Failed to resolve punishment";
    let icon: string | undefined;

    switch (punishment) {
        case PunishmentType.Mute: {
            color = Colors.Orange;
            action = "Member Muted";
            break;
        }

        case PunishmentType.Kick: {
            color = Colors.Red;
            action = "Member Kicked";
            break;
        }

        case PunishmentType.Ban: {
            color = Colors.Blue;
            action = "Member Banned";
            break;
        }

        case PunishmentType.Note: {
            color = Colors.Yellow;
            action = "Note Added";
            icon = "noteUpdate.png";
            break;
        }

        case PunishmentType.Unban: {
            action = "Member Unbanned";
            icon = "memberCreate.png";
            break;
        }

        case PunishmentType.Unmute: {
            color = Colors.Green;
            action = "Member Unmuted";
            icon = "memberCreate.png";
            break;
        }
    }

    return {
        color,
        author: {
            name: action,
            iconURL: `attachment://${icon}`
        },
        file: {
            attachment: `./icons/${icon}`,
            name: icon
        }
    };
}

/** @returns Updated number of pages at index 0. Mapped fields at index 1 */
export function mapInfractionsToFields(data: {
    infractions: MinimalInfraction[],
    filter: InfractionFilter | null,
    page: number
}): [number, APIEmbedField[]] {
    const { infractions, filter, page } = data;
    const filteredInfractions = infractions.filter(infraction => {
        switch (filter) {
            // Automatic infractions are hidden by default
            case InfractionFilter.All:
                return !infraction.archived_at && !infraction.archived_by;
            case InfractionFilter.Automatic:
                return infraction.flag === InfractionFlag.Automatic;
            case InfractionFilter.Archived:
                return infraction.archived_at && infraction.archived_by;
            default:
                return infraction.flag !== InfractionFlag.Automatic
                    && !infraction.archived_at
                    && !infraction.archived_by;
        }
    });

    const fields = filteredInfractions.slice((page - 1) * 5, page * 5).map(infraction => {
        const flag = infraction.flag ? `${InfractionFlag[infraction.flag]} ` : "";

        // Remove all URLs
        const cleanReason = infraction.reason?.replace(/https?:\/\/.+( |$)/gi, "").trim();
        const data = [
            {
                key: "Created",
                val: time(infraction.created_at, TimestampStyles.RelativeTime)
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
                // Temporary infraction is still active
                data.splice(1, 0, {
                    key: "Expires",
                    val: time(infraction.expires_at, TimestampStyles.RelativeTime)
                });
            } else {
                // Temporary infraction has expired
                data.splice(1, 0, {
                    key: "Duration",
                    val: msToString(infraction.expires_at - infraction.created_at)
                });
            }
        }

        return {
            name: `${flag}${PunishmentType[infraction.action]} #${infraction.infraction_id}`,
            value: `>>> ${data.map(({ key, val }) => `\`${key}\` | ${val}`).join("\n")}`
        };
    });

    return [Math.ceil(filteredInfractions.length / 5), fields];
}

export function mapInfractionCount(infractions: InfractionCount): string {
    return Object.entries(infractions)
        .map(([type, count]) => `\`${count ?? 0}\` ${pluralize(capitalize(type), count)}`)
        .join("\n");
}