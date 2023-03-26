import { Colors, EmbedBuilder, User } from "discord.js";
import { sendLog } from "./LoggingUtils";
import { LoggingEvent } from "./Types";

export async function resolveMemberKick(data: {
    moderator: User,
    offender: User,
    guildId: string,
    reason: string | null
}): Promise<void> {
    const { moderator, offender, reason, guildId } = data;

    const log = new EmbedBuilder()
        .setColor(Colors.Red)
        .setAuthor({ name: "Member Kicked" })
        .setFields([
            {
                name: "Member",
                value: `${offender}`,
                inline: true
            },
            {
                name: "Moderator",
                value: `${moderator}`,
                inline: true
            }
        ])
        .setTimestamp();

    if (reason) log.addFields([{ name: "Reason", value: reason }]);

    await sendLog({
        event: LoggingEvent.MemberKick,
        embed: log,
        guildId
    });
}
