import {
    ColorResolvable,
    Colors,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    Message,
    User,
    userMention
} from "discord.js";

import {
    CHANNEL_ID_FROM_URL_REGEX,
    formatTimestamp,
    msToString,
    MUTE_DURATION_VALIDATION_REGEX,
    REQUEST_VALIDATION_REGEX
} from "./index";

import { InfractionFlag, InfractionPunishment } from "../types/db";
import { InfractionData, RequestType } from "../types/utils";
import { cacheMessage, getCachedMessageIds } from "./cache";
import { allQuery, storeInfraction } from "../db";
import { LoggingEvent } from "../types/config";
import { sendLog } from "./logging";

import ClientManager from "../client";
import Config from "./config";
import ms from "ms";

export async function resolveInfraction(data: InfractionData): Promise<number | null> {
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
    const [infractionId] = await Promise.all([
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

    return infractionId;
}

export async function muteMember(offender: GuildMember, data: {
    config: Config,
    moderator: User,
    duration: string,
    reason?: string | null,
    quick?: boolean
}): Promise<string | [number, number | null]> {
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

    const expiresAt = muteExpirationTimestamp(offender);
    if (expiresAt) return `This member has already been muted until ${formatTimestamp(expiresAt, "F")} (expires ${formatTimestamp(expiresAt, "R")}).`;

    let msMuteDuration = ms(duration);

    /* Only allow the duration to be given in days, hours, and minutes */
    if (!duration.match(MUTE_DURATION_VALIDATION_REGEX) || msMuteDuration <= 0) return "The duration provided is not valid.";
    if (msMuteDuration > ms("28d")) msMuteDuration = ms("28d");

    try {
        await offender.timeout(msMuteDuration, reason ?? undefined);
        const infractionId = await resolveInfraction({
            guildId: offender.guild.id,
            punishment: InfractionPunishment.Mute,
            target: offender.user,
            duration: msMuteDuration,
            flag: quick ? InfractionFlag.Quick : undefined,
            executor: moderator,
            reason
        });

        return [Math.floor((msMuteDuration + Date.now()) / 1000), infractionId];
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
    additionalValidation?: {
        condition: boolean,
        reason: string
    }[]
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

export async function validateRequest(data: {
    requestType: RequestType,
    message: Message<true>,
    config: Config,
    isAutoMuteEnabled: boolean
}) {
    const { requestType, message, config, isAutoMuteEnabled } = data;
    if (message.attachments.size && !config.loggingChannel(LoggingEvent.Media)) throw "You cannot add attachments to the request, please link them instead.";

    const isMuteRequest = requestType === RequestType.Mute;
    const { targetId, reason } = REQUEST_VALIDATION_REGEX.exec(message.content)?.groups ?? {};
    REQUEST_VALIDATION_REGEX.lastIndex = 0;

    if (!targetId || !reason) {
        throw [
            "## Invalid request format",
            `Format: \`{user_id / @user}${isMuteRequest ? "(duration)" : ""} {reason}\``,
            "Examples:",
            "- `123456789012345678 Mass spam`",
            "- `<@123456789012345678> Mass spam`",
            isMuteRequest ? "- `123456789012345678 2h Mass spam`" : ""
        ].join("\n");
    }

    // Check if all URLs lead to whitelisted channels
    if (config.allowedProofChannelIds.length) {
        const channelIdMatches = Array.from(reason.matchAll(CHANNEL_ID_FROM_URL_REGEX));
        if (channelIdMatches.some(m => !config.allowedProofChannelIds.includes(m[1]))) {
            throw "Your request contains links to non-whitelisted channels.";
        }
    }

    const cache = ClientManager.cache.requests;
    const requestMessageId = cache.findKey(v => v.targetId === targetId
            && v.requestType === requestType);

    if (requestMessageId && requestMessageId !== message.id) {
        const jumpUrl = `https://discord.com/channels/${message.guildId}/${message.channelId}/${requestMessageId}`;
        throw `A ${requestType} request for ${userMention(targetId)} has already been submitted: ${jumpUrl}`;
    }

    if (reason.length > 1024) throw "The reason length cannot exceed 1,024 characters.";

    const targetMember = await message.guild.members.fetch(targetId).catch(() => null);
    const targetUser = targetMember?.user || await ClientManager.client.users.fetch(targetId).catch(() => null);

    if (!targetUser) throw "The user specified is invalid.";

    if (!isAutoMuteEnabled || requestType === RequestType.Mute) {
        if (targetUser.id === message.author.id) throw "This action cannot be carried out on yourself.";
        if (targetUser.bot) throw "This action cannot be carried out on bots.";
        if (targetMember && config.isGuildStaff(targetMember)) throw "This action cannot be carried out on server staff.";
    }

    if (requestType === RequestType.Mute) {
        if (!targetMember) throw "The member specified is not in the server.";
        if (targetMember.isCommunicationDisabled()) throw "This member is already muted.";
    } else {
        const isBanned = await message.guild.bans.fetch(targetId).catch(() => null);
        if (isBanned) throw "This user is already banned.";
    }

    const reaction = message.reactions.cache.filter(r => r.me).first();

    if (reaction) await reaction.users.remove(ClientManager.client.user?.id);
    if (!cache.has(message.id)) {
        cache.set(message.id, {
            targetId,
            requestType
        });
    }

    return { targetMember, reason };
}

export async function handleBanRequestAutoMute(data: {
    targetMember: GuildMember,
    message: Message<true>,
    reason: string,
    config: Config
}) {
    const { targetMember, message, reason, config } = data;
    const [res, infractionId] = await muteMember(targetMember, {
        moderator: message.author,
        duration: "28d",
        reason,
        config
    }) as [string | number, number];

    if (typeof res === "string" && !targetMember.isCommunicationDisabled()) {
        const reply = await message.reply(`${config.emojis.error} Failed to mute the member automatically.`);

        // Remove after 3 seconds
        setTimeout(async() => {
            await reply.delete().catch(() => null);
        }, 3000);

        return;
    }

    const confirmation = `muted **${targetMember.user.tag}** until ${formatTimestamp(res, "F")} | Expires ${formatTimestamp(res, "R")}`;
    await config.sendConfirmation({
        guild: message.guild,
        message: confirmation,
        authorId: message.author.id,
        allowMentions: true,
        reason
    });

    const requestData = ClientManager.cache.requests.get(message.id)!;
    ClientManager.cache.requests.set(message.id, { ...requestData, infractionId });
}