import { capitalize, extract, formatMuteExpirationResponse, MAX_MUTE_DURATION, RegexPatterns } from "./index";
import { GuildMember, hyperlink, Message, messageLink, Snowflake, User, userMention } from "discord.js";
import { muteMember, resolveInfraction, validateModerationAction } from "./moderation";
import { Requests, RequestValidationResult } from "@/types/requests";
import { LoggingEvent, RolePermission } from "@/types/config";
import { PunishmentType } from "@database/models/infraction";
import { ErrorCause } from "@/types/internals";
import { sendLog } from "./logging";
import { client } from "@/client";

import Config from "./config";
import Cache from "./cache";
import ms from "ms";

export function getRequestType(channelId: Snowflake, config: Config): Requests | null {
    if (channelId === config.channels.banRequestQueue) return Requests.Ban;
    if (channelId === config.channels.muteRequestQueue) return Requests.Mute;
    return null;
}

export async function handleRequestManagement(data: {
    message: Message<true>,
    executor: GuildMember,
    config: Config,
    emojiId: string
}): Promise<void> {
    const { message, executor, config, emojiId } = data;

    const requestType = getRequestType(message.channelId, config);
    if (!requestType) return;

    const permission = `Manage${capitalize(requestType)}Requests` as "ManageBanRequests" | "ManageMuteRequests";
    if (!config.hasPermission(executor, RolePermission[permission])) return;

    if (config.emojis.denyRequest?.includes(emojiId)) {
        await handleRequestDenial({
            config,
            executor: executor.user,
            message,
            requestType
        });
        return;
    }

    await handleRequestApproval({
        config,
        executorId: executor.id,
        message,
        requestType
    });
}

async function handleRequestApproval(data: {
    message: Message<true>,
    executorId: Snowflake,
    config: Config,
    requestType: Requests
}): Promise<void> {
    const { message, executorId, config, requestType } = data;
    const { targetId, reason, duration } = extract(message.content, RegexPatterns.RequestValidation);
    const { error } = config.emojis;

    if (!targetId || !reason) return;

    let formattedReason = reason.trim().replaceAll(/ +/g, " ");

    // Convert attachments to URLs
    if (message.attachments.size) {
        const log = await sendLog({
            event: LoggingEvent.Media,
            guildId: message.guildId,
            options: {
                content: `Media stored for ${userMention(targetId)}'s ${requestType} request`,
                files: Array.from(message.attachments.values()),
                allowedMentions: { parse: [] }
            }
        });

        if (!log) {
            const response = `store media for ${userMention(targetId)}'s ${requestType} request`;
            const confirmation = config.formatConfirmation(response, {
                executorId,
                success: false
            });

            await config.sendNotification(confirmation, { allowMentions: true });
            return;
        }

        formattedReason += ` ${log.url}`;
    }

    const cache = Cache.get(message.guildId);

    // Handle ban request approval
    if (requestType === Requests.Ban) {
        try {
            await message.guild.members.ban(targetId, {
                deleteMessageSeconds: config.deleteMessageSecondsOnBan,
                reason: formattedReason
            });

            const confirmation = config.formatConfirmation(`banned ${userMention(targetId)}`, {
                executorId,
                success: true,
                reason: formattedReason
            });

            await Promise.all([
                resolveInfraction({
                    punishment: PunishmentType.Ban,
                    requestAuthorId: message.author.id,
                    executorId,
                    guildId: message.guildId,
                    reason: formattedReason,
                    targetId
                }),
                config.sendNotification(confirmation)
            ]);

            cache.requests.delete(message.id);
            return;
        } catch (_err) {
            const err = _err as Error;
            const response = `${error} ${userMention(executorId)} Failed to ${requestType} ${userMention(targetId)}: ${err.message}`;

            await config.sendNotification(response, { allowMentions: true });
        }
    }

    // Handle mute request approval
    const targetMember = await message.guild.members.fetch(targetId).catch(() => null);

    if (!targetMember) {
        const confirmation = config.formatConfirmation(`mute ${userMention(targetId)}, user may no longer be in the server`, {
            executorId,
            success: false
        });

        await config.sendNotification(confirmation, { allowMentions: true });
        return;
    }

    try {
        const { expiresAt } = await muteMember(targetMember, {
            config,
            executorId,
            duration: duration || ms(MAX_MUTE_DURATION),
            reason: formattedReason,
            requestAuthorId: message.author.id
        });

        const response = `muted ${targetMember} until ${formatMuteExpirationResponse(expiresAt)}`;
        const confirmation = config.formatConfirmation(response, {
            executorId,
            success: true
        });

        await config.sendNotification(confirmation);
        cache.requests.delete(message.id);
    } catch (_err) {
        const err = _err as Error;
        await config.sendNotification(`${error} ${userMention(executorId)} ${err.message}`, {
            allowMentions: true
        });
    }
}

async function handleRequestDenial(data: {
    requestType: Requests,
    message: Message<true>,
    executor: User,
    config: Config
}): Promise<void> {
    const { requestType, message, executor, config } = data;
    const [targetId] = message.content.split(" ");

    const jumpURL = messageLink(message.id, message.channelId, message.guildId);
    const requestHyperlink = hyperlink(`${requestType} request`, jumpURL);
    const response = `${config.emojis.denyRequest} ${message.author} Your ${requestHyperlink} against ${userMention(targetId)} has been **denied** by ${executor}`;

    await config.sendNotification(response, {
        allowMentions: true
    });
}

export async function validateRequest(data: {
    requestType: Requests,
    request: Message<true>,
    config: Config
}): Promise<RequestValidationResult> {
    const { requestType, request, config } = data;

    if (request.attachments.size && !config.getLoggingChannel(LoggingEvent.Media)) {
        throw new Error("You cannot add attachments to the request, please link them instead.");
    }

    // Values extracted from the request
    const { targetId, reason } = extract(request.content, RegexPatterns.RequestValidation);

    if (!targetId || !reason) throw new Error(requestFormatReminder(requestType));

    // Check if all URLs lead to permitted proof channels
    if (config.proofChannelIds.length) {
        const matches = Array.from(reason.matchAll(RegexPatterns.ChannelIdFromURL.pattern));
        if (matches.some(match => !config.proofChannelIds.includes(match[0]))) {
            throw new Error("Your request contains links to non-whitelisted channels.");
        }
    }

    const cache = Cache.get(config.guildId);
    const duplicateRequestId = cache.requests.findKey((cachedRequest, cachedRequestId) =>
        cachedRequestId !== request.id
        && cachedRequest.targetId === targetId
        && cachedRequest.requestType === requestType
    );

    if (duplicateRequestId) {
        const jumpURL = messageLink(request.channelId, duplicateRequestId, request.guildId);
        throw new Error(`A ${requestType} request for ${userMention(targetId)} has already been submitted: ${jumpURL}`, {
            cause: ErrorCause.DuplicateRequest
        });
    }

    // Reason exceeds 1,024 characters, any media that would be converted to links is accounted for
    if (reason.length + (request.attachments.size * 90) > 1024) {
        throw new Error("The reason length cannot exceed 1,024 characters, this includes potential media URLs.");
    }

    const targetMember = await request.guild.members.fetch(targetId).catch(() => null);
    const targetUser = targetMember?.user || await client.users.fetch(targetId).catch(() => null);

    if (!targetUser) throw new Error("The user specified is invalid.");

    const nonModerateableReason = validateModerationAction({
        target: targetUser,
        executorId: request.author.id,
        config
    });

    if (nonModerateableReason) throw nonModerateableReason;

    if (requestType === Requests.Mute) {
        if (!targetMember) throw new Error("The member specified is not in the server.");
        if (targetMember.isCommunicationDisabled()) throw new Error("This member is already muted.");
    } else {
        const isBanned = await request.guild.bans.fetch(targetId).catch(() => null);
        if (isBanned) throw new Error("This user is already banned.");
    }

    // Remove any reactions added by the bot that indicated a prior issue with the request
    const reaction = request.reactions.cache.filter(r => r.me).first();
    if (reaction) await reaction.users.remove(client.user?.id);

    if (!cache.requests.has(request.id)) {
        cache.requests.set(request.id, {
            targetId,
            requestType,
            muteId: null
        });
    }

    return {
        target: targetMember,
        reason
    };
}

function requestFormatReminder(requestType: Requests): string {
    const isMuteRequest = requestType === Requests.Mute;

    return [
        "## Invalid request format",
        `Format: \`{user_id / @user}${isMuteRequest ? "(duration)" : ""} {reason}\``,
        "Examples:",
        "- `123456789012345678 Mass spam`",
        "- `<@123456789012345678> Mass spam`",
        isMuteRequest ? "- `123456789012345678 2h Mass spam`" : ""
    ].join("\n");
}

export async function handleBanRequestAutoMute(data: {
    target: GuildMember,
    request: Message<true>,
    reason: string,
    config: Config
}): Promise<void> {
    const { target, request, reason, config } = data;

    let expiresAt: null | number = null;
    let infractionId: null | number = null;

    try {
        const res = await muteMember(target, {
            executorId: request.author.id,
            duration: ms(MAX_MUTE_DURATION),
            reason,
            config
        });

        expiresAt = res.expiresAt;
        infractionId = res.infractionId;
    } catch (_error) {
        if (target.isCommunicationDisabled()) return;

        const error = _error as Error;
        const response = config.formatConfirmation(`mute the member automatically`, {
            executorId: target.id,
            success: false,
            reason: error.message
        });

        const reply = await request.reply(response);

        // Remove after 3 seconds
        setTimeout(async() => {
            await reply.delete().catch(() => null);
        }, 3000);

        return;
    }

    const confirmation = config.formatConfirmation(`muted ${target} until ${formatMuteExpirationResponse(expiresAt)}`, {
        executorId: request.author.id,
        success: true,
        reason
    });

    await config.sendNotification(confirmation, { allowMentions: true });

    const cache = Cache.get(config.guildId);
    const requestData = cache.requests.get(request.id);

    if (!requestData) return;

    cache.requests.set(request.id, { ...requestData, muteId: infractionId });
}