import {
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    Message,
    MessageContextMenuCommandInteraction,
    messageLink,
    Snowflake,
    time,
    User,
    userMention
} from "discord.js";

import { InfractionResolveOptions, MemberMuteResult, RequestType, RequestValidationResult } from "../types/utils";
import { currentTimestamp, MAX_MUTE_DURATION, msToString, RegexPatterns } from "./index";
import { InfractionFlag, MessageModel, PunishmentType } from "../types/db";
import { TimestampStyles } from "@discordjs/formatters";
import { getInfractionEmbedData } from "./infractions";
import { allQuery, storeInfraction } from "../db";
import { LoggingEvent } from "../types/config";
import { sendLog } from "./logging";
import { client } from "../client";

import Config from "./config";
import Cache from "./cache";
import ms from "ms";

/**
 * Stores and logs an infraction
 * @returns The infraction ID if the infraction was stored successfully
 */
export async function resolveInfraction(data: InfractionResolveOptions): Promise<number | null> {
    const {
        executorId,
        targetId,
        reason,
        guildId,
        punishment,
        duration,
        requestAuthorId,
        flag
    } = data;

    const { color, author, file } = getInfractionEmbedData(punishment);
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor(author)
        .setFields([
            { name: "Member", value: `${userMention(targetId)} (\`${targetId}\`)` },
            { name: "Moderator", value: `${userMention(executorId)} (\`${executorId}\`)` }
        ])
        .setTimestamp();

    if (duration) embed.addFields({ name: "Duration", value: msToString(duration) });
    if (reason) embed.addFields({ name: "Reason", value: reason });

    const expiresAt = duration ? Math.floor((Date.now() + duration) / 1000) : null;
    const [infractionId] = await Promise.all([
        storeInfraction({
            guildId: guildId,
            action: punishment,
            expiresAt: expiresAt,
            requestAuthorId,
            executorId,
            targetId,
            reason,
            flag
        }),
        sendLog({
            event: LoggingEvent.Infraction,
            guildId,
            options: {
                embeds: [embed],
                files: [file]
            }
        })
    ]);

    return infractionId;
}

export async function muteMember(target: GuildMember, data: {
    config: Config,
    executorId: Snowflake,
    duration: string,
    requestAuthorId?: Snowflake,
    reason?: string | null,
    quick?: boolean
}): Promise<MemberMuteResult> {
    const { config, executorId, duration, reason, quick, requestAuthorId } = data;

    const notModerateableReason = validateModerationAction({
        config,
        target,
        executorId,
        additionalValidation: [{
            condition: !target.moderatable,
            failResponse: "I do not have permission to mute this member."
        }]
    });

    if (notModerateableReason) throw new Error(notModerateableReason);

    const currentMuteExpirationTimestamp = muteExpirationTimestamp(target);

    if (currentMuteExpirationTimestamp) {
        const dateTimestamp = time(currentMuteExpirationTimestamp, TimestampStyles.LongDateTime);
        const relativeTimestamp = time(currentMuteExpirationTimestamp, TimestampStyles.RelativeTime);

        throw new Error(`${target} has already been muted until ${dateTimestamp} (expires ${relativeTimestamp}).`);
    }

    const msDuration = ms(duration);

    if (!duration.match(RegexPatterns.DurationValidation) || msDuration <= 0) {
        throw new Error("The duration provided is invalid.");
    }

    if (msDuration > MAX_MUTE_DURATION) {
        const maxDuration = ms(MAX_MUTE_DURATION, { long: true });
        throw new Error(`The duration cannot exceed ${maxDuration}.`);
    }

    await target.timeout(msDuration, reason ?? undefined);

    const expiresAt = Math.floor(msDuration / 1000) + currentTimestamp();
    const infractionId = await resolveInfraction({
        guildId: target.guild.id,
        punishment: PunishmentType.Mute,
        targetId: target.user.id,
        duration: msDuration,
        flag: quick ? InfractionFlag.Quick : undefined,
        requestAuthorId,
        executorId,
        reason
    });

    return { expiresAt, infractionId };
}

export function muteExpirationTimestamp(member: GuildMember): EpochTimeStamp | null {
    const msExpiresAt = member.communicationDisabledUntilTimestamp;

    if (msExpiresAt && msExpiresAt >= Date.now()) {
        return Math.floor(msExpiresAt / 1000);
    }

    return null;
}

/** @returns {string} The reason why the data failed validation */
export function validateModerationAction(data: {
    config: Config,
    executorId: string,
    target: GuildMember | User,
    additionalValidation?: {
        condition: boolean,
        failResponse: string
    }[]
}): string | null {
    const { executorId, target, additionalValidation, config } = data;

    if (executorId === target.id) return "This action cannot be carried out on yourself.";

    const isBot = target instanceof User ? target.bot : target.user.bot;
    const isGuildStaff = target instanceof GuildMember && config.isGuildStaff(target);

    if (isBot) return "This action cannot be carried out on bots.";
    if (isGuildStaff) return "This action cannot be carried out on server staff.";

    for (const check of additionalValidation ?? []) {
        if (check.condition) return check.failResponse;
    }

    return null;
}

/** @returns {number} The number of messages that have been purged */
export async function purgeMessages(data: {
    channel: GuildTextBasedChannel,
    amount: number,
    executorId: Snowflake,
    targetId?: Snowflake
}): Promise<number> {
    const { channel, amount, targetId, executorId } = data;
    const cache = Cache.get(channel.guildId);

    const messagesToPurge = cache.getMessageIds({
        channelId: channel.id,
        authorId: targetId,
        limit: amount
    });

    if (messagesToPurge.length < amount) {
        const messagesToFetch = amount - messagesToPurge.length;
        const authorCondition = targetId ? `AND author_id = ${targetId}` : "";

        try {
            // @formatter:off
            const storedMessages = await allQuery<Pick<MessageModel, "message_id">>(`
                UPDATE messages
                SET deleted = 1
                WHERE message_id IN (
                    SELECT message_id FROM messages
                    WHERE channel_id = ${channel.id} ${authorCondition} 
                        AND guild_id = ${channel.guildId}
                        AND message_id NOT IN (${messagesToPurge.join(",")}) -- Not cached
                        AND deleted = 0
                    ORDER BY created_at DESC
                    LIMIT ${messagesToFetch}
                )
                RETURNING message_id;
            `);

            messagesToPurge.push(...storedMessages.map(({ message_id }) => message_id));
        } catch (err) {
            console.error(err);
        }
    }

    cache.messages.purged = {
        targetId,
        executorId,
        messageIds: messagesToPurge
    };

    const purgedMessages = await channel.bulkDelete(messagesToPurge);
    return purgedMessages.size;
}

export async function validateRequest(data: {
    requestType: RequestType,
    request: Message<true>,
    config: Config
}): Promise<RequestValidationResult> {
    const { requestType, request, config } = data;

    if (request.attachments.size && !config.getLoggingChannel(LoggingEvent.Media)) {
        throw new Error("You cannot add attachments to the request, please link them instead.");
    }

    // Values extracted from the request
    const { targetId, reason } = RegexPatterns.RequestValidation.exec(request.content)?.groups ?? {};
    RegexPatterns.RequestValidation.lastIndex = 0;

    if (!targetId || !reason) throw requestFormatReminder(requestType);

    // Check if all URLs lead to permitted proof channels
    if (config.proofChannelIds.length) {
        const matches = Array.from(reason.matchAll(RegexPatterns.ChannelIdFromURL));
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
        throw new Error(`A ${requestType} request for ${userMention(targetId)} has already been submitted: ${jumpURL}`);
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

    if (requestType === RequestType.Mute) {
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

function requestFormatReminder(requestType: RequestType): string {
    const isMuteRequest = requestType === RequestType.Mute;

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

    const dateTimestamp = time(expiresAt, TimestampStyles.LongDateTime);
    const relativeTimestamp = time(expiresAt, TimestampStyles.RelativeTime);
    const confirmation = config.formatConfirmation(`muted ${target} until ${dateTimestamp} | Expires ${relativeTimestamp}`, {
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

export async function handleQuickMute(duration: "30m" | "1h", interaction: MessageContextMenuCommandInteraction<"cached">, config: Config): Promise<void> {
    const targetMessage = interaction.targetMessage as Message<true>;
    const { success, error } = config.emojis;

    if (!targetMessage.member) {
        await interaction.reply({
            content: `${error} Failed to fetch the message author.`,
            ephemeral: true
        });
        return;
    }

    const reason = targetMessage.content;

    try {
        const { expiresAt } = await muteMember(targetMessage.member, {
            executorId: interaction.user.id,
            quick: true,
            duration,
            config,
            reason
        });

        const expiresAtDateTimestamp = time(expiresAt, TimestampStyles.LongDateTime);
        const expiresAtRelativeTimestamp = time(expiresAt, TimestampStyles.RelativeTime);
        const response = `quick muted ${targetMessage.author} until ${expiresAtDateTimestamp} | Expires ${expiresAtRelativeTimestamp}`;

        const confirmation = config.formatConfirmation(response, {
            executorId: interaction.user.id,
            success: true,
            reason
        });

        await Promise.all([
            purgeMessages({
                channel: targetMessage.channel,
                amount: 100,
                executorId: interaction.user.id,
                targetId: targetMessage.author.id
            }),
            interaction.reply({
                content: `${success} Successfully ${response}`,
                ephemeral: true
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: targetMessage.channel.id
            })
        ]);
        return;
    } catch (_err) {
        const err = _err as Error;

        await interaction.reply({
            content: `${error} ${err.message}`,
            ephemeral: true
        });
    }
}