import {
    currentTimestamp,
    ensureError,
    formatMuteExpirationResponse,
    MAX_MUTE_DURATION,
    msToString,
    RegexPatterns
} from "./index";

import { EmbedBuilder, GuildMember, GuildTextBasedChannel, Snowflake, time, User, userMention } from "discord.js";
import { InfractionFlag, InfractionResolveOptions, PunishmentType } from "@database/models/infraction";
import { MemberMuteResult, QuickMuteParams } from "@bot/types/moderation";
import { MessageModel } from "@database/models/message";
import { db, storeInfraction } from "@database/utils";
import { TimestampStyles } from "@discordjs/formatters";
import { getInfractionEmbedData } from "./infractions";
import { LoggingEvent } from "@bot/types/config";
import { SQLQueryBindings } from "bun:sqlite";
import { sendLog } from "./logging";

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

    if (!duration.match(RegexPatterns.DurationValidation.pattern) || msDuration <= 0) {
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

        try {
            // @formatter:off
            const deleteMessagesQuery = db.prepare<Pick<MessageModel, "message_id">, SQLQueryBindings>(`
                UPDATE messages
                SET deleted = 1
                WHERE message_id IN (
                    SELECT message_id FROM messages
                    WHERE channel_id = $channelId
                        AND ($authorId IS NULL OR author_id = $authorId)
                        AND guild_id = $guildId
                        AND message_id NOT IN ($messageIds) -- Not cached
                        AND deleted = 0
                    ORDER BY created_at DESC
                    LIMIT $limit
                )
                RETURNING message_id;
            `);

            // @formatter:on
            const storedMessages = deleteMessagesQuery.all({
                $channelId: channel.id,
                $guildId: channel.guildId,
                $limit: messagesToFetch,
                $authorId: targetId ?? null,
                $messageIds: messagesToPurge.join(",")
            });

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

/** @returns {Object} The response to send to the executor and whether the operation was successful */
export async function handleQuickMute(data: QuickMuteParams): Promise<{ response: string, success: boolean }> {
    const { message, duration, executorId, config } = data;
    const { emojis } = config;

    if (!message.member) {
        return {
            response: `${emojis.error} Failed to fetch the message author.`,
            success: false
        };
    }

    try {
        const { expiresAt } = await muteMember(message.member, {
            executorId,
            quick: true,
            duration,
            config,
            reason: message.content
        });

        const response = `quick muted ${message.author} until ${formatMuteExpirationResponse(expiresAt)}`;
        const confirmation = config.formatConfirmation(response, {
            executorId: executorId,
            success: true,
            reason: message.content
        });

        await Promise.all([
            purgeMessages({
                channel: message.channel,
                amount: 100,
                executorId,
                targetId: message.author.id
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: message.channelId
            })
        ]);

        return {
            response: `${emojis.success} Successfully ${response}`,
            success: true
        };
    } catch (_error) {
        const error = ensureError(_error);
        return {
            response: `${emojis.error} ${userMention(executorId)} ${error.message}`,
            success: false
        };
    }
}