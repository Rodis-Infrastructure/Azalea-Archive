import {
    AttachmentPayload,
    Colors,
    EmbedBuilder,
    Events,
    hyperlink,
    Message,
    messageLink,
    PartialMessage
} from "discord.js";

import { handleInfractionReasonChange } from "@bot/interactions/global_commands/infraction";
import { formatLogContent, referenceEmbed, sendLog } from "@bot/utils/logging";
import { handleBanRequestAutoMute, validateRequest } from "@bot/utils/requests";
import { handleMediaChannelMessage } from "@bot/listeners/messageCreate";
import { LoggingEvent, RolePermission } from "@bot/types/config";
import { ErrorCause } from "@bot/types/internals";
import { Requests } from "@bot/types/requests";
import { ensureError, serializeMessage } from "@bot/utils";
import { client } from "@bot/client";

import EventListener from "@bot/handlers/listeners/eventListener";
import Config from "@bot/utils/config";
import Cache from "@bot/utils/cache";

export default class MessageUpdateEventListener extends EventListener {
    constructor() {
        super(Events.MessageUpdate);
    }

    async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
        const message = newMessage.partial
            ? await newMessage.fetch().catch(() => null)
            : newMessage;

        if (!message?.inGuild()) return;

        const config = Config.get(message.guildId);
        if (!config) return;

        // Remove messages from media channel if it doesn't have an attachment or a link
        if (config.isMediaChannel(message.channelId)) await handleMediaChannelMessage(message, config);

        if (message.channelId === config.channels.muteRequestQueue || message.channelId === config.channels.banRequestQueue) {
            await handleRequestEdit(message, config);
        }

        const cache = Cache.get(message.guildId);

        if (!message.author.bot && message.content !== oldMessage.content) {
            await cache.handleEditedMessage(newMessage.id, message.content);

            const serializedOldMessage = oldMessage.partial
                ? await cache.fetchMessage(oldMessage.id)
                : serializeMessage(oldMessage as Message<true>);

            if (serializedOldMessage?.content) await handleMessageEditLog(message, serializedOldMessage.content);
        }
    }
}

async function handleMessageEditLog(message: Message<true>, oldContent: string): Promise<void> {
    const jumpURL = messageLink(message.channelId, message.id, message.guildId);
    const log = new EmbedBuilder()
        .setColor(Colors.Orange)
        .setDescription(hyperlink("Jump to Message", jumpURL))
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

    if (message.reference?.messageId) {
        const reference = await message.fetchReference().catch(() => null);
        const cache = Cache.get(message.guildId);
        const serializedReference = reference
            ? serializeMessage(reference)
            : await cache.fetchMessage(message.reference.messageId);

        if (serializedReference) {
            const { embed, file } = await referenceEmbed(serializedReference, !reference);

            embeds.unshift(embed);
            files.push(file);
        }
    }

    await sendLog({
        event: LoggingEvent.Message,
        options: { embeds, files },
        sourceChannel: message.channel
    });
}

async function handleRequestEdit(message: Message<true>, config: Config): Promise<void> {
    // Don't do anything if someone reacted to the message
    if (message.reactions.cache.some(reaction =>
        reaction.users.cache.size &&
        !reaction.users.cache.has(message.client.user.id)
    )) return;

    const requestType = message.channelId === config.channels.muteRequestQueue
        ? Requests.Mute
        : Requests.Ban;

    if (!message.member) return;

    const isAutoMuteEnabled = requestType === Requests.Ban
        && config.hasPermission(message.member, RolePermission.AutoMuteBanRequests);

    if (!isAutoMuteEnabled) return;

    try {
        const { target, reason } = await validateRequest({
            requestType,
            request: message,
            config
        });

        const cache = Cache.get(message.guildId);
        const request = cache.requests.get(message.id);

        // If a mute is already linked to the infraction, edit the reason
        if (request && request.muteId) {
            await handleInfractionReasonChange(request.muteId, {
                newReason: reason,
                updatedById: message.author.id,
                guildId: message.guildId
            });
            return;
        }

        if (target) {
            await handleBanRequestAutoMute({
                target,
                reason,
                config,
                request: message
            });
        }
    } catch (_error) {
        const error = ensureError(_error);
        const emoji = error.cause === ErrorCause.DuplicateRequest ? "🔄" : "⚠️";

        const existingReaction = message.reactions.cache
            .filter(reaction => reaction.me && reaction.emoji.name !== emoji)
            .first();

        if (existingReaction) await existingReaction.users.remove(client.user?.id);

        const [reply] = await Promise.all([
            message.reply({
                content: `${config.emojis.error} Failed to validate request: ${error.message}`,
                allowedMentions: { parse: [], repliedUser: true }
            }),
            message.react(emoji)
        ]);

        // Remove after 5 seconds
        setTimeout(async () => {
            await reply.delete().catch(() => null);
        }, 5000);
    }
}