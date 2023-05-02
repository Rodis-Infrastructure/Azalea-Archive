import { ColorResolvable, Colors, EmbedBuilder, User } from "discord.js";
import { sendLog } from "./LoggingUtils";
import { InfractionType, LoggingEvent } from "./Types";
import ms from "ms";

export async function resolveInfraction(data: {
    moderator: User,
    offender: User,
    guildId: string,
    reason?: string | null,
    infractionType: InfractionType,
    duration?: number
}): Promise<void> {
    const {
        moderator,
        offender,
        reason,
        guildId,
        infractionType,
        duration
    } = data;

    let color!: ColorResolvable;

    switch (infractionType) {
        case InfractionType.Ban:
            color = Colors.Blurple;
            break;

        case InfractionType.Kick:
            color = Colors.Red;
            break;

        case InfractionType.Unban:
            color = Colors.DarkButNotBlack;
            break;

        case InfractionType.Mute:
            color = Colors.NotQuiteBlack;
            break;

        case InfractionType.Unmute:
            color = Colors.DarkButNotBlack;
            break;
    }

    const log = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: infractionType })
        .setFields([
            {
                name: "Member",
                value: `${offender} (\`${offender.id}\`)`
            },
            {
                name: "Moderator",
                value: `${moderator} (\`${moderator.id}\`)`
            }
        ])
        .setTimestamp();

    if (duration) log.addFields([{ name: "Duration", value: ms(duration, { long: true }) }]);
    if (reason) log.addFields([{ name: "Reason", value: reason }]);

    await sendLog({
        event: LoggingEvent.Infraction,
        embed: log,
        guildId
    });
}