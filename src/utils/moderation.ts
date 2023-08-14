import { ColorResolvable, Colors, EmbedBuilder, GuildMember, GuildTextBasedChannel, User } from "discord.js";
import { InfractionData } from "../types/utils";
import { formatTimestamp, msToString, MUTE_DURATION_VALIDATION_REGEX } from "./index";
import { InfractionFlag, InfractionPunishment } from "../types/db";
import { cacheMessage, getCachedMessageIds } from "./cache";
import { allQuery, storeInfraction } from "../db";
import { sendLog } from "./logging";

import ClientManager from "../client";
import Config from "./config";
import ms from "ms";
import { LoggingEvent } from "../types/config";

export async function resolveInfraction(data: InfractionData): Promise<void> {
    const {
        executor,
        target,
        reason,
        guildId,
        punishment,
        duration,
        requestAuthor,
        flag
    } = data;

    let color: ColorResolvable = Colors.Red;
    let icon = "memberDelete.png";
    let authorText = "Failed to resolve punishment type";

    switch (punishment) {
        case InfractionPunishment.Ban: {
            authorText = "Member Banned";
            color = Colors.Blue;
            break;
        }

        case InfractionPunishment.Kick: {
            authorText = "Member Kicked";
            break;
        }

        case InfractionPunishment.Mute: {
            authorText = "Member Muted";
            color = Colors.Orange;
            break;
        }

        case InfractionPunishment.Note: {
            authorText = "Note Added";
            color = Colors.Yellow;
            icon = "note.png";
            break;
        }

        case InfractionPunishment.Unban: {
            authorText = "Member Unbanned";
            icon = "memberCreate.png";
            color = Colors.Green;
            break;
        }

        case InfractionPunishment.Unmute:
            authorText = "Member Unmuted";
            icon = "memberCreate.png";
            color = Colors.Green;
            break;
    }

    const log = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: authorText, iconURL: `attachment://${icon}` })
        .setFields([
            { name: "Member", value: `${target} (\`${target.id}\`)` },
            { name: "Moderator", value: `${executor} (\`${executor.id}\`)` }
        ])
        .setTimestamp();

    if (duration) log.addFields([{ name: "Duration", value: msToString(duration) }]);
    if (reason) log.addFields([{ name: "Reason", value: reason }]);

    const expiresAt = duration ? Math.floor((Date.now() + duration) / 1000) : null;
    await Promise.all([
        storeInfraction({
            guildId: guildId,
            action: punishment,
            executorId: executor.id,
            targetId: target.id,
            expiresAt: expiresAt,
            requestAuthorId: requestAuthor?.id,
            reason,
            flag
        }),
        sendLog({
            event: LoggingEvent.Infraction,
            guildId,
            options: {
                embeds: [log],
                files: [{
                    attachment: `./icons/${icon}`,
                    name: icon
                }]
            }
        })
    ]);
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
    if (!duration.match(MUTE_DURATION_VALIDATION_REGEX) || msMuteDuration <= 0) return "The duration provided is not valid.";
    if (msMuteDuration > ms("28d")) msMuteDuration = ms("28d");

    try {
        await offender.timeout(msMuteDuration, reason ?? undefined);
        await resolveInfraction({
            guildId: offender.guild.id,
            punishment: InfractionPunishment.Mute,
            target: offender.user,
            duration: msMuteDuration,
            flag: quick ? InfractionFlag.Quick : undefined,
            executor: moderator,
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
        const authorCondition = authorId ? `AND author_id = ${authorId}` : "";

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