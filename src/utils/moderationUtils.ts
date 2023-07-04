import { ColorResolvable, Colors, EmbedBuilder, GuildMember, GuildTextBasedChannel, User } from "discord.js";
import { InfractionData, InfractionType, LoggingEvent } from "./utils.types";
import { DURATION_FORMAT_REGEX, formatTimestamp, msToString } from "./index";
import { InfractionAction, InfractionFlag } from "../db/db.types";
import { cacheMessage, getCachedMessageIds } from "./cache";
import { allQuery, storeInfraction } from "../db";
import { sendLog } from "./loggingUtils";

import ClientManager from "../client";
import Config from "./config";
import ms from "ms";

export async function resolveInfraction(data: InfractionData): Promise<void> {
    const {
        moderator,
        offender,
        reason,
        guildId,
        infractionType,
        duration,
        requestAuthor,
        flag
    } = data;

    let color: ColorResolvable = Colors.Red;
    let icon = "memberDelete.png";
    let dbInfractionType: InfractionAction | null = null;

    switch (infractionType) {
        case InfractionType.Ban: {
            dbInfractionType = InfractionAction.Ban;
            color = Colors.Blue;
            break;
        }

        case InfractionType.Kick: {
            dbInfractionType = InfractionAction.Kick;
            break;
        }

        case InfractionType.Mute: {
            dbInfractionType = InfractionAction.Mute;
            color = Colors.Orange;
            break;
        }

        case InfractionType.Note: {
            dbInfractionType = InfractionAction.Note;
            color = Colors.Yellow;
            icon = "note.png";
            break;
        }

        case InfractionType.Unban: {
            dbInfractionType = InfractionAction.Unban;
            icon = "memberCreate.png";
            color = Colors.Green;
            break;
        }

        case InfractionType.Unmute:
            icon = "memberCreate.png";
            color = Colors.Green;
            break;
    }

    const log = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: infractionType, iconURL: `attachment://${icon}` })
        .setFields([
            { name: "Member", value: `${offender} (\`${offender.id}\`)` },
            { name: "Moderator", value: `${moderator} (\`${moderator.id}\`)` }
        ])
        .setTimestamp();

    if (duration) log.addFields([{ name: "Duration", value: msToString(duration) }]);
    if (reason) log.addFields([{ name: "Reason", value: reason }]);

    const expiresAt = duration ? Math.floor((Date.now() + duration) / 1000) : null;

    if (dbInfractionType) {
        await storeInfraction({
            guildId: guildId,
            action: dbInfractionType,
            executorId: moderator.id,
            targetId: offender.id,
            expiresAt: expiresAt,
            requestAuthorId: requestAuthor?.id,
            reason,
            flag
        });
    }

    await sendLog({
        event: LoggingEvent.Infraction,
        guildId,
        options: {
            embeds: [log],
            files: [{
                attachment: `./icons/${icon}`,
                name: icon
            }]
        }
    });
}

export async function muteMember(offender: GuildMember, data: {
    config: Config,
    moderator: User,
    duration: string,
    reason?: string | null,
    quick?: boolean
}): Promise<string | number> {
    const { config, moderator, duration, reason, quick } = data;

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
    if (expiresAt) return `This member has already been muted until ${formatTimestamp(expiresAt, "F")} (expires ${formatTimestamp(expiresAt, "R")}).`;

    let msMuteDuration = ms(duration);

    /* Only allow the duration to be given in days, hours, and minutes */
    if (!duration.match(DURATION_FORMAT_REGEX) || msMuteDuration <= 0) return "The duration provided is not valid.";
    if (msMuteDuration > ms("28d")) msMuteDuration = ms("28d");

    try {
        await offender.timeout(msMuteDuration, reason ?? undefined);
        await resolveInfraction({
            guildId: offender.guild.id,
            infractionType: InfractionType.Mute,
            offender: offender.user,
            duration: msMuteDuration,
            flag: quick ? InfractionFlag.Quick : undefined,
            moderator,
            reason
        });

        return Math.floor((msMuteDuration + Date.now()) / 1000);
    } catch {
        return "An error has occurred while trying to execute this interaction";
    }
}

export function muteExpirationTimestamp(member: GuildMember): number | void {
    const msExpiresAt = member.communicationDisabledUntilTimestamp;
    if (msExpiresAt && msExpiresAt >= Date.now()) return Math.floor(msExpiresAt / 1000);
}

export function validateModerationAction(data: {
    config: Config,
    moderatorId: string,
    offender: GuildMember,
    additionalValidation?: { condition: boolean, reason: string }[]
}): string | void {
    const { moderatorId, offender, additionalValidation, config } = data;

    if (moderatorId === offender.id) return "This action cannot be carried out on yourself.";
    if (offender.user.bot) return "This action cannot be carried out on bots.";
    if (config.isGuildStaff(offender)) return "This action cannot be carried out on server staff.";

    for (const check of additionalValidation ?? []) {
        if (check.condition) return check.reason;
    }
}

export async function purgeMessages(data: {
    channel: GuildTextBasedChannel,
    amount: number,
    moderatorId: string,
    authorId?: string
}): Promise<number> {
    const { channel, amount, authorId, moderatorId } = data;

    const cache = ClientManager.cache.messages;
    const removableMessageIds = getCachedMessageIds({
        channelId: channel.id,
        guildId: channel.guildId,
        authorId: authorId,
        limit: amount
    });

    removableMessageIds.forEach(id => cacheMessage(id, { deleted: true }));

    if (removableMessageIds.length < amount) {
        const messagesToFetch = amount - removableMessageIds.length;
        const authorCondition = authorId ? `AND authorId = ${authorId}` : "";

        try {
            const excludedIds = [...removableMessageIds, ...Array.from(cache.remove)].join(",");

            // @formatter:off
            const storedMessages = await allQuery<{ messageId: string }>(`
                DELETE FROM messages
                WHERE message_id IN (
                    SELECT message_id FROM messages
                    WHERE channel_id = ${channel.id} ${authorCondition} 
                        AND guild_id = ${channel.guildId}
                        AND message_id NOT IN (${excludedIds})
                    ORDER BY created_at DESC
                    LIMIT ${messagesToFetch}
                )
                RETURNING message_id;
            `);

            removableMessageIds.push(...storedMessages.map(({ messageId }) => messageId));
        } catch (err) {
            console.error(err);
        }
    }

    cache.purged = {
        targetId: authorId,
        data: removableMessageIds,
        moderatorId
    };

    const res = await channel.bulkDelete(removableMessageIds);
    return res.size;
}