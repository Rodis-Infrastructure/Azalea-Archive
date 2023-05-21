import { ColorResolvable, Colors, EmbedBuilder, GuildMember, GuildTextBasedChannel, User } from "discord.js";
import { InfractionData, InfractionType, LoggingEvent } from "./Types";
import { cacheMessage, getCachedMessageIds } from "./Cache";
import { sendLog } from "./LoggingUtils";
import { msToString } from "./index";
import { conn } from "../db";

import ClientManager from "../Client";
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

    let color: ColorResolvable = Colors.Red;
    let icon = "memberDelete.png";

    switch (infractionType) {
        case InfractionType.Unban:
        case InfractionType.Unmute:
            icon = "memberCreate.png";
            color = Colors.Green;
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
    reason?: string | null
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

        return Math.floor((msMuteDuration + Date.now()) / 1000);
    } catch {
        return "An error has occurred while trying to mute this member.";
    }
}

export function muteExpirationTimestamp(member: GuildMember): number | void {
    const mutedExpirationTimestamp = member.communicationDisabledUntilTimestamp;
    if (mutedExpirationTimestamp && mutedExpirationTimestamp >= Date.now()) return Math.floor(mutedExpirationTimestamp / 1000);
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
            const storedMessages = await new Promise((resolve, reject) => {
                // @formatter:off
                conn.all(`
					DELETE FROM messages
					WHERE id IN (
					    SELECT id FROM messages
                        WHERE channelId = ${channel.id} ${authorCondition} 
                            AND guildId = ${channel.guildId}
                            AND id NOT IN (${excludedIds})
                        ORDER BY createdAt DESC
                        LIMIT ${messagesToFetch}
                    )
					RETURNING CAST(id AS TEXT) AS id;
                `, (err, rows: { id: string }[]) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }) as { id: string }[];

            removableMessageIds.push(...storedMessages.map(({ id }) => id));
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