import { AttachmentPayload, Colors, EmbedBuilder, Events, GuildMember, hyperlink, Message } from "discord.js";
import { formatLogContent, referenceEmbed } from "../utils/logging";
import { handleBanRequestAutoMute, validateRequest } from "../utils/moderation";
import { handleInfractionReasonChange } from "../interactions/commands/infraction";
import { LoggingEvent } from "../types/config";
import { RequestType } from "../types/utils";
import { serializeMessage } from "../db";
import { client } from "../client";

import EventListener from "../handlers/listeners/eventListener";
import Config from "../utils/config";
import Cache from "../utils/cache";

export default class MessageUpdateEventListener extends EventListener {
    constructor() {
        super(Events.MessageUpdate);
    }

    async execute(oldMessage: Message<true>, newMessage: Message<true>): Promise<void> {
        if (!oldMessage.inGuild() || !newMessage.inGuild()) return;

        const fetchedMessage = newMessage.partial
            ? await newMessage.fetch().catch(() => null)
            : newMessage;

        if (!fetchedMessage) return;

        const config = Config.get(fetchedMessage.guildId);
        if (!config) return;

        if (fetchedMessage.channelId === config.channels?.muteRequestQueue || fetchedMessage.channelId === config.channels?.banRequestQueue) {
            await handleRequestEdit(fetchedMessage, config);
        }

        const cache = Cache.get(fetchedMessage.guildId);

        if (!fetchedMessage.author?.bot && fetchedMessage.content !== oldMessage.content) {
            await cache.handleEditedMessage(newMessage.id, fetchedMessage.content);

            const serializedOldMessage = oldMessage.partial
                ? await cache.fetchMessage(oldMessage.id)
                : serializeMessage(oldMessage);

            if (serializedOldMessage?.content) await handleMessageEditLog(fetchedMessage, serializedOldMessage.content);
        }
    }
}

async function handleMessageEditLog(message: Message<true>, oldContent: string) {
    const messageJumpURL = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
    const log = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setDescription(hyperlink("Jump to Message", messageJumpURL))
        .setAuthor({
            name: "Message Updated",
            iconURL: "attachment://messageUpdate.png"
        })
        .setFields([
            {
                name: "Author",
                value: `${message.author} (\`${message.author.id}\`)`
            },
            {
                name: "Channel",
                value: `${message.channel}`
            },
            {
                name: "Before",
                value: formatLogContent(oldContent)
            },
            {
                name: "After",
                value: formatLogContent(message.content)
            }
        ])
        .setTimestamp();

    const embeds = [log];
    const files: AttachmentPayload[] = [{
        attachment: "./icons/messageUpdate.png",
        name: "messageUpdate.png"
    }];

    if (message?.reference?.messageId) {
        const fetchedReference = await message.fetchReference().catch(() => null);
        const cache = Cache.get(message.guildId);
        const serializedReference = fetchedReference
            ? serializeMessage(fetchedReference)
            : await cache.fetchMessage(message.reference.messageId);

        if (serializedReference) {
            const { embed, file } = referenceEmbed(serializedReference, {
                deleted: !fetchedReference
            });

            embeds.unshift(embed);
            files.push(file);
        }
    }

    await log({
        event: LoggingEvent.Message,
        options: { embeds, files },
        channelId: message.channelId,
        categoryId: message.channel.parentId,
        guildId: message.guildId
    });
}

async function handleRequestEdit(message: Message<true>, config: Config) {
    if (message.reactions.cache.some(r =>
        r.users.cache.size &&
        !r.users.cache.has(message.client.user.id)
    )) return;

    const requestType = message.channelId === config.channels?.muteRequestQueue
        ? RequestType.Mute
        : RequestType.Ban;

    const isAutoMuteEnabled = requestType === RequestType.Ban
        && config.hasPermission(message.member as GuildMember, {
            permission: "autoMuteBanRequests",
            requiredValue: true
        });

    try {
        const { targetMember, reason } = await validateRequest({
            isBanRequest: isAutoMuteEnabled,
            requestType,
            request: message,
            config
        });

        const cache = Cache.get(message.guildId);
        const request = cache.requests.get(message.id);

        if (request && request.muteId) {
            await handleInfractionReasonChange({
                infractionId: request.muteId,
                newReason: reason,
                updatedById: message.author,
                guildId: message.guildId
            });
        } else if (targetMember && isAutoMuteEnabled) {
            await handleBanRequestAutoMute({
                target: targetMember,
                reason,
                config,
                request: message
            });
        }
    } catch (err) {
        const reason = err as string;
        const reaction = reason.includes("already been submitted") ? "🔄" : "⚠️";
        const existingReaction = message.reactions.cache
            .filter(r => r.me && r.emoji.name !== reaction)
            .first();

        if (existingReaction) await existingReaction.users.remove(client.user?.id);

        const [reply] = await Promise.all([
            message.reply({
                content: reason,
                allowedMentions: { parse: [], repliedUser: true }
            }),
            message.react(reaction)
        ]);

        // Remove after 5 seconds
        setTimeout(async() => {
            await reply.delete().catch(() => null);
        }, 5000);
    }
}