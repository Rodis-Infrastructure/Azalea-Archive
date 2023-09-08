import {
    AttachmentPayload,
    channelMention,
    Colors,
    EmbedBuilder,
    Events,
    Message,
    MessageType,
    userMention
} from "discord.js";

import { createReferenceLog, formatLogContent, linkToPurgeLog, sendLog } from "../utils/logging";
import { processPartialDeletedMessage } from "../utils/cache";
import { LoggingEvent } from "../types/config";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";
import { MessageModel } from "../types/db";
import { serializeMessageToDatabaseModel } from "../utils";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageDelete);
    }

    async execute(deletedMessage: Message): Promise<void> {
        if (!deletedMessage.inGuild()) return;
        ClientManager.cache.requests.delete(deletedMessage.id);

        let reference!: MessageModel | null;
        let message!: MessageModel | null;

        if (!deletedMessage.partial) message = serializeMessageToDatabaseModel(deletedMessage, true);
        if (deletedMessage.reference) {
            const fetchedReference = await deletedMessage.fetchReference();
            reference = serializeMessageToDatabaseModel(fetchedReference);
        }

        const data = await processPartialDeletedMessage(
            deletedMessage.id,
            deletedMessage.type === MessageType.Reply && !deletedMessage.reference
        );

        message ??= data.message;
        reference ??= data.reference;

        if (!message) return;

        const messageDeleteLog = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: "Message Deleted", iconURL: "attachment://messageDelete.png" })
            .setFields([
                {
                    name: "Author",
                    value: userMention(message.author_id)
                },
                {
                    name: "Channel",
                    value: channelMention(message.channel_id)
                },
                {
                    name: "Content",
                    value: formatLogContent(message.content)
                }
            ])
            .setTimestamp();

        const embeds = [messageDeleteLog];
        const files: AttachmentPayload[] = [{
            attachment: "./icons/messageDelete.png",
            name: "messageDelete.png"
        }];

        // Message is a reply
        if (reference) {
            const referenceLog = createReferenceLog({
                authorId: reference.author_id,
                content: reference.content,
                messageId: reference.message_id,
                guildId: reference.guild_id,
                channelId: reference.channel_id
            });

            embeds.unshift(referenceLog.embed);
            files.push(referenceLog.file);
        }

        const log = await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channelId: message.channel_id,
            guildId: message.guild_id
        });

        if (!log) return;

        await linkToPurgeLog({
            content: message.message_id,
            guildId: message.guild_id,
            url: log.url
        });
    }
}