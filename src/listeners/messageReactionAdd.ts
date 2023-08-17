import { capitalize, formatTimestamp, REQUEST_VALIDATION_REGEX } from "../utils";
import { muteMember, purgeMessages, resolveInfraction, validateModerationAction } from "../utils/moderation";
import { Events, GuildTextBasedChannel, hyperlink, Message, MessageReaction, User, userMention } from "discord.js";
import { InfractionPunishment } from "../types/db";
import { LoggingEvent, RolePermission } from "../types/config";
import { RequestType } from "../types/utils";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";
import { sendLog } from "../utils/logging";

export default class MessageReactionAddEventListener extends EventListener {
    constructor() {
        super(Events.MessageReactionAdd);
    }

    async execute(reaction: MessageReaction, user: User): Promise<void> {
        if (!reaction.message.inGuild()) return;
        const { emoji, message } = reaction;

        if (user.bot || !message.guild) return;

        const config = ClientManager.config(reaction.message.guildId!)!;
        const member = await message.guild.members.fetch(user.id);

        const emojiId = emoji.id ?? emoji.name ?? "N/A";
        const { emojis } = config;

        /* Quick mutes - 30 minutes and 1 hour */
        if (emojis.quickMute30?.includes(emojiId) || emojis.quickMute60?.includes(emojiId)) {
            if (!message.member) return;

            let muteDuration = "30m";
            let emojiName = "quickMute30";

            if (emojis.quickMute60?.includes(emojiId)) {
                muteDuration = "60m";
                emojiName = "quickMute60";
            }

            if (!config.actionAllowed(member, {
                permission: RolePermission.Reaction,
                requiredValue: emojiName
            })) return;

            const reason = message.content;
            const [res] = await muteMember(message.member, {
                moderator: user,
                duration: muteDuration,
                config,
                reason
            });

            /* The result is the mute's expiration timestamp */
            if (typeof res === "number") {
                await Promise.all([
                    purgeMessages({
                        channel: message.channel as GuildTextBasedChannel,
                        amount: 100,
                        moderatorId: user.id,
                        authorId: message.member.id
                    }),
                    config.sendConfirmation({
                        guild: message.guild,
                        message: `quick muted **${message.author?.tag}** until ${formatTimestamp(res, "F")} | Expires ${formatTimestamp(res, "R")}`,
                        authorId: user.id,
                        reason
                    })
                ]);

                return;
            }

            /* The result is an error message */
            await Promise.all([
                reaction.remove(),
                config.sendConfirmation({
                    guild: message.guild,
                    message: `${emojis.error} ${user} ${res}`,
                    full: true
                })
            ]);

            return;
        }

        if (emojis.purgeMessages?.includes(emojiId)) {
            if (!config.actionAllowed(member, {
                permission: RolePermission.Reaction,
                requiredValue: "purgeMessages"
            })) return;

            if (message.member) {
                const notModerateableReason = validateModerationAction({
                    config,
                    moderatorId: user.id,
                    offender: message.member
                });

                if (notModerateableReason) {
                    await config.sendConfirmation({
                        guild: message.guild,
                        message: `${emojis.error} ${user} ${notModerateableReason}`,
                        full: true
                    });

                    return;
                }
            }

            await Promise.all([
                reaction.remove(),
                purgeMessages({
                    channel: reaction.message.channel as GuildTextBasedChannel,
                    amount: 100,
                    authorId: reaction.message.author?.id,
                    moderatorId: user.id
                })
            ]).catch(() => null);
        }

        if (
            (message.channelId === config.channels.banRequestQueue || message.channelId === config.channels.muteRequestQueue) &&
            (emojis.denyRequest?.includes(emojiId) || emojis.approveRequest?.includes(emojiId))
        ) {
            const requestType = message.channelId === config.channels.banRequestQueue
                ? RequestType.Ban
                : RequestType.Mute;

            if (!config.actionAllowed(member, {
                permission: `manage${capitalize(requestType) as "Ban" | "Mute"}Requests`,
                requiredValue: true
            })) return;

            if (emojis.denyRequest?.includes(emojiId)) {
                const [targetId] = message.content.split(" ");
                const jumpUrl = hyperlink(`${requestType} request`, `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`);

                await config.sendConfirmation({
                    guild: message.guild,
                    message: `${emojis.denyRequest} ${message.author} Your ${jumpUrl} against ${userMention(targetId)} has been **denied** by ${user}`,
                    allowMentions: true,
                    full: true
                });
            }

            if (emojis.approveRequest?.includes(emojiId)) {
                const { targetId, reason, duration } = REQUEST_VALIDATION_REGEX.exec(message.content)?.groups ?? {};
                let formattedReason = reason.trim().replaceAll(/ +/g, " ");
                REQUEST_VALIDATION_REGEX.lastIndex = 0;

                if (message.attachments.size) {
                    const storedMediaLog = await sendLog({
                        event: LoggingEvent.Media,
                        guildId: message.guildId,
                        options: {
                            content: `Media stored for ${userMention(targetId)}'s ${requestType} request`,
                            files: Array.from(message.attachments.values()),
                            allowedMentions: { parse: [] }
                        }
                    }) as Message<true>;

                    for (const attachment of storedMediaLog.attachments.values()) {
                        formattedReason += ` ${attachment.url}`;
                    }
                }

                try {
                    if (requestType === RequestType.Ban) {
                        await message.guild.members.ban(targetId, {
                            deleteMessageSeconds: config.deleteMessageSecondsOnBan,
                            reason: formattedReason
                        });

                        await Promise.all([
                            resolveInfraction({
                                punishment: InfractionPunishment.Ban,
                                requestAuthor: message.author,
                                executor: user,
                                guildId: message.guildId,
                                reason: formattedReason,
                                targetId
                            }),
                            config.sendConfirmation({
                                guild: message.guild,
                                authorId: user.id,
                                message: `banned ${userMention(targetId)}`,
                                reason: formattedReason
                            })
                        ]);

                        ClientManager.cache.requests.delete(message.id);
                        return;
                    }

                    const targetMember = await message.guild.members.fetch(targetId).catch(() => null);

                    if (!targetMember) {
                        await config.sendConfirmation({
                            guild: message.guild,
                            message: `${emojis.error} ${message.author} Failed to ${requestType} ${userMention(targetId)}, user may no longer be in the server`,
                            allowMentions: true,
                            full: true
                        });

                        return;
                    }

                    const [res] = await muteMember(targetMember, {
                        config,
                        moderator: user,
                        duration: duration || "28d",
                        reason: formattedReason
                    });

                    if (typeof res === "string") {
                        await config.sendConfirmation({
                            guild: message.guild,
                            message: `${emojis.error} ${message.author} ${res}`,
                            allowMentions: true,
                            full: true
                        });

                        return;
                    }

                    await config.sendConfirmation({
                        guild: message.guild,
                        authorId: user.id,
                        message: `muted **${member.user.tag}** until ${formatTimestamp(res, "F")} | Expires ${formatTimestamp(res, "R")}`,
                        reason: formattedReason
                    });

                    ClientManager.cache.requests.delete(message.id);
                } catch {
                    await config.sendConfirmation({
                        guild: message.guild,
                        message: `${emojis.error} ${message.author} Failed to ${requestType} ${userMention(targetId)}`,
                        allowMentions: true,
                        full: true
                    });
                }
            }
        }
    }
}