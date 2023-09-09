import { AttachmentPayload, channelMention, Colors, EmbedBuilder, Events, Message, userMention } from "discord.js";
import { createReferenceLog, formatLogContent, linkToPurgeLog, sendLog } from "../utils/logging";
import { processPartialDeletedMessage } from "../utils/cache";
import { serializeMessageToDatabaseModel } from "../utils";
import { LoggingEvent } from "../types/config";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageDelete);
    }

    async execute(deletedMessage: Message): Promise<void> {
        if (!deletedMessage.inGuild()) return;

        ClientManager.cache.requests.delete(deletedMessage.id);

        const fetchedReference = await deletedMessage.fetchReference().catch(() => null);
        const data = await processPartialDeletedMessage(deletedMessage.id, {
            fetchReference: !fetchedReference
        });

        const reference = fetchedReference
            ? serializeMessageToDatabaseModel(fetchedReference)
            : data.reference;

        const message = !deletedMessage.partial
            ? serializeMessageToDatabaseModel(deletedMessage, true)
            : data.message;

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
            const { embed, file } = createReferenceLog(reference);
            embeds.unshift(embed);
            files.push(file);
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