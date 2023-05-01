import { ColorResolvable, Colors, EmbedBuilder, User } from "discord.js";
import { sendLog } from "./LoggingUtils";
import { LoggingEvent } from "./Types";

export async function resolveInfraction(data: {
    moderator: User,
    offender: User,
    guildId: string,
    reason: string | null,
    infractionType: LoggingEvent
}): Promise<void> {
    const { moderator, offender, reason, guildId, infractionType } = data;
    let name!: string;
    let color!: ColorResolvable;

    switch (infractionType) {
        case LoggingEvent.MemberBan:
            name = "Member Banned";
            color = Colors.Purple;
            break;

        case LoggingEvent.MemberKick:
            name = "Member Kicked";
            color = Colors.Red;
            break;

        case LoggingEvent.MemberUnban:
            name = "Member Unbanned";
            color = Colors.Blue;
            break;
    }

    const log = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name })
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

    if (reason) log.addFields([{ name: "Reason", value: reason }]);

    await sendLog({
        event: infractionType,
        embed: log,
        guildId
    });
}