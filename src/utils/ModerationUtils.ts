import { ColorResolvable, Colors, EmbedBuilder, GuildMember, User } from "discord.js";
import { sendLog } from "./LoggingUtils";
import { InfractionType, LoggingEvent } from "./Types";
import ms from "ms";
import prettyPrint from "pretty-print-ms";
import Config from "./Config";

export async function resolveInfraction(data: {
    moderator: User,
    offender: User,
    guildId: string,
    reason?: string,
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

    if (duration) log.addFields([{ name: "Duration", value: prettyPrint(duration) }]);
    if (reason) log.addFields([{ name: "Reason", value: reason }]);

    await sendLog({
        event: LoggingEvent.Infraction,
        embed: log,
        guildId
    });
}

export async function muteMember(data: {
    config: Config,
    moderator: User,
    offender: GuildMember,
    duration: string,
    reason?: string
}): Promise<string | number> {
    const { config, moderator, offender, duration, reason } = data;

    const notModerateableReason = validateModerationReason({
        config,
        moderatorId: moderator.id,
        offender,
        additionalValidation: [{
            condition: !offender.moderatable,
            reason: "I do not have permission to mute this member."
        }]
    });

    if (notModerateableReason) return notModerateableReason;

    const mutedUntilTimestamp = await mutedUntil(offender);
    if (mutedUntilTimestamp) return `This member has already been muted until <t:${mutedUntilTimestamp}:F> (expires <t:${mutedUntilTimestamp}:R>).`;

    let msDuration = ms(duration);
    if (!duration.match(/^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi) || msDuration <= 0) return "The duration provided is not valid.";

    if (msDuration > ms("28d")) msDuration = ms("28d");

    try {
        await offender.timeout(msDuration, reason ?? undefined);
        await resolveInfraction({
            guildId: offender.guild.id,
            infractionType: InfractionType.Mute,
            offender: offender.user,
            duration: msDuration,
            moderator,
            reason
        });

        msDuration += ms(Date.now().toString());
        msDuration = Math.round(msDuration / 1000);

        return msDuration;
    } catch {
        return "An error has occurred while trying to mute this member.";
    }
}

export function mutedUntil(member: GuildMember): number | void {
    const currentTimestamp = ms(Date.now().toString());
    const mutedTimestamp = member.communicationDisabledUntilTimestamp;

    if (mutedTimestamp && mutedTimestamp >= currentTimestamp) return Math.round(mutedTimestamp / 1000);
}

export function validateModerationReason(data: {
    config: Config,
    moderatorId: string,
    offender: GuildMember,
    additionalValidation?: { condition: boolean, reason: string }[]
}): string | void {
    const { moderatorId, offender, additionalValidation, config } = data;

    if (moderatorId === offender.id) return "You cannot moderate yourself.";
    if (offender.user.bot) return "Bots cannot be moderated.";
    if (config.isGuildStaff(offender)) return "Server staff cannot be moderated.";

    for (const check of additionalValidation ?? []) {
        if (check.condition) return check.reason;
    }
}