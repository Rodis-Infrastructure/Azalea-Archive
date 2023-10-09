import {
    EmbedBuilder,
    Events,
    GuildTextBasedChannel,
    hideLinkEmbed,
    hyperlink,
    Message,
    MessageReaction,
    User,
    userMention
} from "discord.js";

import { muteMember, purgeMessages, resolveInfraction, validateModerationAction } from "../utils/moderation";
import { LoggingEvent, RolePermission } from "../types/config";
import { formatLogContent, sendLog } from "../utils/logging";
import { capitalize, RegexPatterns } from "../utils";
import { PunishmentType } from "../types/db";
import { RequestType } from "../types/utils";

import EventListener from "../handlers/listeners/eventListener";
import Config from "../utils/config";
import Cache from "../utils/cache";

export default class MessageReactionAddEventListener extends EventListener {
    constructor() {
        super(Events.MessageReactionAdd);
    }

    async execute(reaction: MessageReaction, user: User): Promise<void> {
        if (!reaction.message.inGuild() || user.bot) return;

        const { emoji, message } = reaction;
        const config = Config.get(message.guildId);

        if (!config) return;

        const member = await message.guild.members.fetch(user.id);
        const emojiId = emoji.id ?? emoji.name ?? "N/A";
        const { emojis } = config;

        const fetchedReaction = await reaction.fetch();

        // First to react logs
        if (fetchedReaction.count === 1) {
            const embed = new EmbedBuilder()
                .setColor(0x9C84EF)
                .setAuthor({ name: "Reaction Added", iconURL: "attachment://addReaction.png" })
                .setDescription(hyperlink("Jump to message", message.url))
                .setTimestamp();

            if (emoji.id && emoji.url) {
                embed.setFields({
                    name: "Emoji",
                    value: `\n\n\`<:${emoji.name}:${emoji.id}>\` (${hyperlink("view", emoji.url)})`
                });
            } else {
                embed.setFields({
                    name: "Emoji",
                    value: `\n\n${emoji}`
                });
            }

            embed.addFields([
                {
                    name: "Reactee",
                    value: `${user} (\`${user.id}\`)`
                },
                {
                    name: "Channel",
                    value: `${message.channel} (\`#${message.channel.name}\`)`
                },
                {
                    name: "Content",
                    value: formatLogContent(message.content)
                }
            ]);

            await sendLog({
                event: LoggingEvent.Message,
                channelId: message.channelId,
                categoryId: message.channel.parentId,
                guildId: message.guildId,
                options: {
                    embeds: [embed],
                    files: [{
                        attachment: "./icons/addReaction.png",
                        name: "addReaction.png"
                    }]
                }
            });
        }

        /* Quick mutes - 30 minutes and 1 hour */
        if (emojis.quickMute30?.includes(emojiId) || emojis.quickMute60?.includes(emojiId)) {
            if (!message.member) return;

            let muteDuration = "30m";
            let emojiName = "quickMute30";

            if (emojis.quickMute60?.includes(emojiId)) {
                muteDuration = "60m";
                emojiName = "quickMute60";
            }

            if (!config.hasPermission(member, {
                permission: RolePermission.Reaction,
                requiredValue: emojiName
            })) return;

            const reason = message.content;
            const [res] = await muteMember(message.member, {
                executorId: user,
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
                        executorId: user.id,
                        targetId: message.member.id
                    }),
                    config.sendActionConfirmation({
                        message: `quick muted **${message.author?.tag}** until ${discordTimestamp(res, "F")} | Expires ${discordTimestamp(res, "R")}`,
                        authorId: user.id,
                        reason
                    })
                ]);

                return;
            }

            /* The result is an error message */
            await Promise.all([
                reaction.remove(),
                config.sendActionConfirmation({
                    message: `${emojis.error} ${user} ${res}`,
                    allowMentions: true,
                    full: true
                })
            ]);

            return;
        }

        if (emojis.purgeMessages?.includes(emojiId)) {
            if (!config.hasPermission(member, {
                permission: RolePermission.Reaction,
                requiredValue: "purgeMessages"
            })) return;

            if (message.member) {
                const notModerateableReason = validateModerationAction({
                    config,
                    executorId: user.id,
                    target: message.member
                });

                if (notModerateableReason) {
                    await config.sendActionConfirmation({
                        message: `${emojis.error} ${user} ${notModerateableReason}`,
                        allowMentions: true,
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
                    targetId: reaction.message.author?.id,
                    executorId: user.id
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

            if (!config.hasPermission(member, {
                permission: `manage${capitalize(requestType) as "Ban" | "Mute"}Requests`,
                requiredValue: true
            })) return;

            if (emojis.denyRequest?.includes(emojiId)) {
                const [targetId] = message.content.split(" ");
                const jumpUrl = hyperlink(`${requestType} request`, `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`);

                await config.sendActionConfirmation({
                    message: `${emojis.denyRequest} ${message.author} Your ${jumpUrl} against ${userMention(targetId)} has been **denied** by ${user}`,
                    allowMentions: true,
                    full: true
                });
            }

            if (emojis.approveRequest?.includes(emojiId)) {
                const {
                    targetId,
                    reason,
                    duration
                } = RegexPatterns.RequestValidation.exec(message.content)?.groups ?? {};
                let formattedReason = reason.trim().replaceAll(/ +/g, " ");
                RegexPatterns.RequestValidation.lastIndex = 0;

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
                        formattedReason += ` ${hideLinkEmbed(attachment.url)}`;
                    }
                }

                try {
                    const cache = Cache.get(message.guildId);

                    if (requestType === RequestType.Ban) {
                        await message.guild.members.ban(targetId, {
                            deleteMessageSeconds: config.deleteMessageSecondsOnBan,
                            reason: formattedReason
                        });

                        await Promise.all([
                            resolveInfraction({
                                punishment: PunishmentType.Ban,
                                requestAuthorId: message.author,
                                executor: user,
                                guildId: message.guildId,
                                reason: formattedReason,
                                targetId
                            }),
                            config.sendActionConfirmation({
                                authorId: user.id,
                                message: `banned ${userMention(targetId)}`,
                                reason: formattedReason
                            })
                        ]);

                        cache.requests.delete(message.id);
                        return;
                    }

                    const targetMember = await message.guild.members.fetch(targetId).catch(() => null);

                    if (!targetMember) {
                        await config.sendActionConfirmation({
                            message: `${emojis.error} ${message.author} Failed to ${requestType} ${userMention(targetId)}, user may no longer be in the server`,
                            allowMentions: true,
                            full: true
                        });

                        return;
                    }

                    const [res] = await muteMember(targetMember, {
                        config,
                        executorId: user,
                        duration: duration || "28d",
                        reason: formattedReason,
                        requestAuthor: message.author
                    });

                    if (typeof res === "string") {
                        await config.sendActionConfirmation({
                            message: `${emojis.error} ${message.author} ${res}`,
                            allowMentions: true,
                            full: true
                        });

                        return;
                    }

                    await config.sendActionConfirmation({
                        authorId: user.id,
                        message: `muted **${member.user.tag}** until ${discordTimestamp(res, "F")} | Expires ${discordTimestamp(res, "R")}`,
                        reason: formattedReason
                    });

                    cache.requests.delete(message.id);
                } catch {
                    await config.sendActionConfirmation({
                        message: `${emojis.error} ${message.author} Failed to ${requestType} ${userMention(targetId)}`,
                        allowMentions: true,
                        full: true
                    });
                }
            }
        }
    }
}