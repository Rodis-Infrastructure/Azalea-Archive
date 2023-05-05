import { ColorResolvable, Colors, EmbedBuilder, GuildMember, User } from "discord.js";
import { InfractionData, InfractionType, LoggingEvent } from "./Types";
import { sendLog } from "./LoggingUtils";
import { msToString } from "./index";

import Config from "./Config";
import ms from "ms";

export async function resolveInfraction(data: InfractionData): Promise<void> {
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

    if (duration) log.addFields([{ name: "Duration", value: msToString(duration) }]);
    if (reason) log.addFields([{ name: "Reason", value: reason }]);

    await sendLog({
        event: LoggingEvent.Infraction,
        embed: log,
        guildId
    });
}

export async function muteMember(offender: GuildMember, data: {
    config: Config,
    moderator: User,
    duration: string,
    reason?: string
}): Promise<string | number> {
    const { config, moderator, duration, reason } = data;

    const notModerateableReason = validateModerationAction({
        config,
        moderatorId: moderator.id,
        offender,
        additionalValidation: [{
            condition: !offender.moderatable,
            reason: "I do not have permission to mute this member."
        }]
    });

    if (notModerateableReason) return notModerateableReason;

    const expiresAt = await muteExpirationTimestamp(offender);
    if (expiresAt) return `This member has already been muted until <t:${expiresAt}:F> (expires <t:${expiresAt}:R>).`;

    let msMuteDuration = ms(duration);

    /* Only allow the duration to be given in days, hours, and minutes */
    if (!duration.match(/^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi) || msMuteDuration <= 0) return "The duration provided is not valid.";
    if (msMuteDuration > ms("28d")) msMuteDuration = ms("28d");

    try {
        await offender.timeout(msMuteDuration, reason ?? undefined);
        await resolveInfraction({
            guildId: offender.guild.id,
            infractionType: InfractionType.Mute,
            offender: offender.user,
            duration: msMuteDuration,
            moderator,
            reason
        });

        msMuteDuration += ms(Date.now().toString());
        return Math.floor(msMuteDuration / 1000);
    } catch {
        return "An error has occurred while trying to mute this member.";
    }
}

export function muteExpirationTimestamp(member: GuildMember): number | void {
    const timestamp = {
        now: ms(Date.now().toString()),
        muted: member.communicationDisabledUntilTimestamp
    };

    if (timestamp.muted && timestamp.muted >= timestamp.now) return Math.floor(timestamp.muted / 1000);
}

export function validateModerationAction(data: {
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