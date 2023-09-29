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

import { InfractionFlag, InfractionType, MessageModel } from "../types/db";
import { discordTimestamp, msToString, RegexPatterns } from "./index";
import { InfractionData, RequestType } from "../types/utils";
import { allQuery, storeInfraction } from "../db";
import { LoggingEvent } from "../types/config";
import { sendLog } from "./logging";

import Config from "./config";
import Cache from "./cache";
import ms from "ms";
import { client } from "../client";

export async function resolveInfraction(data: InfractionData): Promise<number | null> {
    const {
        executor,
        targetId,
        reason,
        guildId,
        punishment,
        duration,
        requestAuthor,
        flag
    } = data;

    let embedColor: ColorResolvable = Colors.Red;
    let embedAuthorIcon = "memberDelete.png";
    let embedAuthorText = "Failed to resolve punishment type";

    switch (punishment) {
        case InfractionType.Ban: {
            embedAuthorText = "Member Banned";
            embedColor = Colors.Blue;
            break;
        }

        case InfractionType.Kick: {
            embedAuthorText = "Member Kicked";
            break;
        }

        case InfractionType.Mute: {
            embedAuthorText = "Member Muted";
            embedColor = Colors.Orange;
            break;
        }

        case InfractionType.Note: {
            embedAuthorText = "Note Added";
            embedColor = Colors.Yellow;
            embedAuthorIcon = "note.png";
            break;
        }

        case InfractionType.Unban: {
            embedAuthorText = "Member Unbanned";
            embedAuthorIcon = "memberCreate.png";
            embedColor = Colors.Green;
            break;
        }

        case InfractionType.Unmute:
            embedAuthorText = "Member Unmuted";
            embedAuthorIcon = "memberCreate.png";
            embedColor = Colors.Green;
            break;
    }

    const log = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: embedAuthorText, iconURL: `attachment://${embedAuthorIcon}` })
        .setFields([
            { name: "Member", value: `${userMention(targetId)} (\`${targetId}\`)` },
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
            expiresAt: expiresAt,
            requestAuthorId: requestAuthor?.id,
            targetId,
            reason,
            flag
        }),
        sendLog({
            event: LoggingEvent.Infraction,
            guildId,
            options: {
                embeds: [log],
                files: [{
                    attachment: `./icons/${embedAuthorIcon}`,
                    name: embedAuthorIcon
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
    requestAuthor?: User,
    reason?: string | null,
    quick?: boolean
}): Promise<[number | string, number | null]> {
    const { config, moderator, duration, reason, quick, requestAuthor } = data;

    const notModerateableReason = validateModerationAction({
        config,
        moderatorId: moderator.id,
        offender,
        additionalValidation: [{
            condition: !offender.moderatable,
            reason: "I do not have permission to mute this member."
        }]
    });

    if (notModerateableReason) return [notModerateableReason, null];

    const expiresAt = muteExpirationTimestamp(offender);
    if (expiresAt) return [`This member has already been muted until ${discordTimestamp(expiresAt, "F")} (expires ${discordTimestamp(expiresAt, "R")}).`, null];

    let msMuteDuration = ms(duration);

    /* Only allow the duration to be given in days, hours, and minutes */
    if (!duration.match(RegexPatterns.DurationValidation) || msMuteDuration <= 0) return ["The duration provided is not valid.", null];
    if (msMuteDuration > ms("28d")) msMuteDuration = ms("28d");

    try {
        await offender.timeout(msMuteDuration, reason ?? undefined);
        const infractionId = await resolveInfraction({
            guildId: offender.guild.id,
            punishment: InfractionType.Mute,
            targetId: offender.user.id,
            duration: msMuteDuration,
            flag: quick ? InfractionFlag.Quick : undefined,
            executor: moderator,
            requestAuthor,
            reason
        });

        return [Math.floor((msMuteDuration + Date.now()) / 1000), infractionId];
    } catch {
        return ["An error has occurred while trying to execute this interaction", null];
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
    const cache = Cache.get(channel.guildId);

    const removableMessageIds = cache.getMessageIds({
        channelId: channel.id,
        authorId: authorId,
        limit: amount
    });

    if (removableMessageIds.length < amount) {
        const messagesToFetch = amount - removableMessageIds.length;
        const authorCondition = authorId ? `AND author_id = ${authorId}` : "";

        try {
            // @formatter:off
            const storedMessages = await allQuery<Pick<MessageModel, "message_id">>(`
                UPDATE messages
                SET deleted = 1
                WHERE message_id IN (
                    SELECT message_id FROM messages
                    WHERE channel_id = ${channel.id} ${authorCondition} 
                        AND guild_id = ${channel.guildId}
                        AND message_id NOT IN (${removableMessageIds.join(",")}) -- Not cached
                        AND deleted = 0
                    ORDER BY created_at DESC
                    LIMIT ${messagesToFetch}
                )
                RETURNING message_id;
            `);

            removableMessageIds.push(...storedMessages.map(({ message_id }) => message_id));
        } catch (err) {
            console.error(err);
        }
    }

    cache.messages.purged = {
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
    const { targetId, reason } = RegexPatterns.RequestValidation.exec(message.content)?.groups ?? {};
    RegexPatterns.RequestValidation.lastIndex = 0;

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
        const channelIdMatches = Array.from(reason.matchAll(RegexPatterns.ChannelIdFromURL));
        if (channelIdMatches.some(m => !config.allowedProofChannelIds.includes(m[1]))) {
            throw "Your request contains links to non-whitelisted channels.";
        }
    }

    const cache = Cache.get(config.guildId).requests;
    const requestMessageId = cache.findKey(v => v.targetId === targetId
            && v.requestType === requestType);

    if (requestMessageId && requestMessageId !== message.id) {
        const jumpUrl = `https://discord.com/channels/${message.guildId}/${message.channelId}/${requestMessageId}`;
        throw `A ${requestType} request for ${userMention(targetId)} has already been submitted: ${jumpUrl}`;
    }

    if (reason.length + (message.attachments.size * 90) > 1024) throw "The reason length cannot exceed 1,024 characters, this includes potential media URLs.";

    const targetMember = await message.guild.members.fetch(targetId).catch(() => null);
    const targetUser = targetMember?.user || await client.users.fetch(targetId).catch(() => null);

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

    if (reaction) await reaction.users.remove(client.user?.id);
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

    if (typeof res === "string") {
        if (targetMember.isCommunicationDisabled()) return;
        const reply = await message.reply(`${config.emojis.error} Failed to mute the member automatically.`);

        // Remove after 3 seconds
        setTimeout(async() => {
            await reply.delete().catch(() => null);
        }, 3000);

        return;
    }

    const confirmation = `muted **${targetMember.user.tag}** until ${discordTimestamp(res, "F")} | Expires ${discordTimestamp(res, "R")}`;
    await config.sendConfirmation({
        message: confirmation,
        authorId: message.author.id,
        allowMentions: true,
        reason
    });

    const cache = Cache.get(config.guildId).requests;
    const requestData = cache.get(message.id)!;

    cache.set(message.id, { ...requestData, muteId: infractionId });
}