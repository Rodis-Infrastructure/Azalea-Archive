import {
    capitalize,
    ensureError,
    extract,
    formatMuteExpirationResponse,
    MAX_MUTE_DURATION,
    RegexPatterns,
    ROLE_REQUEST_MENTION_LIMIT
} from "./index";

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    Guild,
    GuildMember,
    GuildTextBasedChannel,
    hyperlink,
    Message,
    messageLink,
    Snowflake,
    StringSelectMenuBuilder,
    User,
    userMention
} from "discord.js";

import { muteMember, resolveInfraction, validateModerationAction } from "./moderation";
import { Requests, RequestValidationResult } from "@bot/types/requests";
import { LoggingEvent, RolePermission } from "@bot/types/config";
import { PunishmentType } from "@database/models/infraction";
import { ErrorCause } from "@bot/types/internals";
import { sendLog } from "./logging";
import { client } from "@bot/client";

import Config from "./config";
import Cache from "./cache";
import ms from "ms";
import { getQuery, runQuery } from "@database/utils";
import { TemporaryRole } from "@database/models/temporaryRole";

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
    const { emojis } = config;

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
                executorId: executorId,
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
                executorId: executorId,
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
        } catch (_error) {
            const error = ensureError(_error);
            const response = `${emojis.error} ${userMention(executorId)} Failed to ${requestType} ${userMention(targetId)}: ${error.message}`;
            await config.sendNotification(response, { allowMentions: true });
        }
    }

    // Handle mute request approval
    const targetMember = await message.guild.members.fetch(targetId).catch(() => null);

    if (!targetMember) {
        const confirmation = config.formatConfirmation(`mute ${userMention(targetId)}, user may no longer be in the server`, {
            executorId: executorId,
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
            executorId: executorId,
            success: true
        });

        await config.sendNotification(confirmation);
        cache.requests.delete(message.id);
    } catch (_error) {
        const error = ensureError(_error);
        await config.sendNotification(`${emojis.error} ${userMention(executorId)} ${error.message}`, {
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

        const error = ensureError(_error);
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

export async function handleRoleRequest(message: Message<true>, config: Config): Promise<void> {
    const mentions = message.mentions.users;

    // Limit the amount of users that can be mentioned to avoid exceeding the character limit
    if (mentions.size > ROLE_REQUEST_MENTION_LIMIT) {
        await message.reply(`You can only mention up to \`${ROLE_REQUEST_MENTION_LIMIT}\` users at a time.`);
        return;
    }

    const options = await config.getRequestableRoleOptions();

    if (!options.length) {
        await message.reply("No roles have been configured for role requests.");
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setAuthor({ name: `Role Request (by ${message.author.tag})`, iconURL: message.author.displayAvatarURL() })
        .setFields({
            name: "Users",
            value: Array.from(mentions.values()).join("\n")
        })
        .setFooter({ text: `ID: ${message.author.id}` })
        .setTimestamp();

    const roles = new StringSelectMenuBuilder()
        .setCustomId("role-request-role-add")
        .setPlaceholder("Select role...")
        .setOptions(options);

    const noteBtn = new ButtonBuilder()
        .setCustomId("role-request-note-add")
        .setStyle(ButtonStyle.Primary)
        .setLabel("Add Note");

    const selectMenuActionRow = new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(roles);
    const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(noteBtn);

    await Promise.all([
        message.delete().catch(() => null),
        message.channel.send({
            embeds: [embed],
            components: [selectMenuActionRow, buttonActionRow]
        })
    ]);
}

/**
 * Set a timeout for removing a temporary role
 *
 * - Removes the role from the users
 * - Deletes the request message
 * - Deletes the record from the database
 */
export function setTemporaryRoleTimeout(data: {
    requestQueue: GuildTextBasedChannel,
    requestId: Snowflake,
    expiresAt: number,
    guild: Guild
}): void {
    const { guild, requestId, requestQueue, expiresAt } = data;
    const config = Config.get(guild.id);

    if (!config) {
        throw new Error(`setTemporaryRoleTimeout - Failed to fetch config for guild ${guild.id}`);
    }

    setTimeout(async() => {
        // Get the most up-to-date result
        const res = await getQuery<Pick<TemporaryRole, "role_id" | "users">>(`
            SELECT role_id, users
            FROM temporary_roles
            WHERE request_id = ${requestId}
        `);

        if (!res) return;

        const [members, request] = await Promise.all([
            guild.members.fetch({ user: res.users.split(",") }),
            requestQueue.messages.fetch(requestId)
        ]);

        await Promise.all([
            ...members.map(member => member.roles.remove(res.role_id)),
            request.delete().catch(() => null),
            runQuery(`DELETE
                      FROM temporary_roles
                      WHERE request_id = ${requestId}`)
        ]);
    }, expiresAt - Date.now());
}