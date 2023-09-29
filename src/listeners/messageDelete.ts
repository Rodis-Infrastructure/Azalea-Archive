import { AttachmentPayload, channelMention, Colors, EmbedBuilder, Events, Message, userMention } from "discord.js";
import { createReferenceLog, formatLogContent, linkToPurgeLog, sendLog } from "../utils/logging";
import { LoggingEvent } from "../types/config";
import { serializeMessage } from "../db";

import EventListener from "../handlers/listeners/eventListener";
import Cache from "../utils/cache";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageDelete);
    }

    async execute(deletedMessage: Message): Promise<void> {
        if (!deletedMessage.inGuild()) return;

        const cache = Cache.get(deletedMessage.guildId);
        cache.requests.delete(deletedMessage.id);

        const fetchedReference = await deletedMessage.fetchReference().catch(() => null);
        const data = await cache.handleDeletedMessage(deletedMessage.id, !fetchedReference);

        const reference = fetchedReference
            ? serializeMessage(fetchedReference)
            : data.reference;

        const message = !deletedMessage.partial
            ? serializeMessage(deletedMessage, true)
            : data.message;

        if (!message) return;

        const messageDeleteLog = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: "Message Deleted", iconURL: "attachment://messageDelete.png" })
            .setFields([
                {
                    name: "Author",
                    value: `${userMention(message.author_id)} (\`${message.author_id}\`)`
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
            const { embed, file } = createReferenceLog(reference, {
                referenceDeleted: !fetchedReference
            });

            embeds.unshift(embed);
            files.push(file);
        }

        const log = await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channelId: message.channel_id,
            categoryId: message.category_id,
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