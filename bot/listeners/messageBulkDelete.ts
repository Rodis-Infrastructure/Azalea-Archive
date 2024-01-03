import {
    AttachmentBuilder,
    Collection,
    Events,
    GuildTextBasedChannel,
    hyperlink,
    Message,
    PartialMessage,
    Snowflake,
    userMention
} from "discord.js";

import { MessageModel } from "@database/models/message";
import { linkToPurgeLog, sendLog } from "@bot/utils/logging";
import { LoggingEvent } from "@bot/types/config";
import { serializeMessage } from "@bot/utils";

import EventListener from "@bot/handlers/listeners/eventListener";
import Cache from "@bot/utils/cache";

export default class MessageBulkDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageBulkDelete);
    }

    async execute(deletedMessages: Collection<Snowflake, Message<true> | PartialMessage>, channel: GuildTextBasedChannel): Promise<void> {
        /** References mapped by their reply's ID */
        const references = new Collection<Snowflake, MessageModel>();
        const cache = Cache.get(channel.guildId);

        const partialMessages = new Set<Snowflake>();
        const authors = new Set<ReturnType<typeof userMention>>();
        const messages = new Set<MessageModel>();

        // If the messages were purged, no data needs to be fetched
        if (cache.messages.purged?.messages.some(({ message_id }) => deletedMessages.has(message_id))) {
            for (const message of cache.messages.purged.messages) {
                await storeMessageAndReference({
                    message,
                    channel,
                    cache,
                    sets: {
                        messages,
                        authors,
                        references
                    }
                });
            }
        } else {
            for (const message of deletedMessages.values()) {
                if (message.partial) {
                    partialMessages.add(message.id);
                    continue;
                }

                await storeMessageAndReference({
                    message: serializeMessage(message, true),
                    channel,
                    cache,
                    sets: {
                        messages,
                        authors,
                        references
                    }
                });
            }

            const cachedMessages = await cache.handleBulkDeletedMessages(partialMessages);

            for (const message of cachedMessages) {
                await storeMessageAndReference({
                    message,
                    channel,
                    cache,
                    sets: {
                        messages,
                        authors,
                        references
                    }
                });
            }
        }

        // There are no messages to log
        if (!messages.size) return;

        /** Messages by their creation date (descending) */
        const sortedMessages = Array.from(messages)
            .sort((a, b) => a.created_at - b.created_at);

        const entries = sortedMessages.map(message => {
            const createdAtTimestamp = new Date(message.created_at).toLocaleString("en-GB");
            const reference = references.get(message.message_id);
            const entry = `[${createdAtTimestamp}] ${message.author_id} — ${message.content}`;

            if (reference) {
                const referenceCreatedAtTimestamp = new Date(reference.created_at).toLocaleString("en-GB");

                return `REF: [${referenceCreatedAtTimestamp}] ${reference.author_id} — ${reference.content}\n` +
                    ` └── ${entry}`;
            }

            return entry;
        });

        const buffer = Buffer.from(entries.join("\n\n"));
        const file = new AttachmentBuilder(buffer)
            .setName(`messages.txt`)
            .setDescription("Purged messages");

        const authorMentions = Array.from(authors).join(" ");
        const log = await sendLog({
            event: LoggingEvent.Message,
            sourceChannel: channel,
            options: {
                content: `Purged \`${messages.size}\` messages in ${channel} (\`#${channel.name}\`) by: ${authorMentions}`,
                allowedMentions: { parse: [] },
                files: [file]
            }
        });

        if (!log) return;

        const attachmentId = log.attachments.first()!.id;
        const url = `https://txt.discord.website?txt=${log.channelId}/${attachmentId}/messages&raw=true`;

        await Promise.all([
            log.edit(`${log.content}\n\n${hyperlink("Open in browser", url)}`),
            linkToPurgeLog({
                guildId: channel.guildId,
                data: Array.from(messages),
                url: log.url
            })
        ]);
    }
}

async function storeMessageAndReference(data: {
    message: MessageModel,
    channel: GuildTextBasedChannel,
    cache: Cache,
    sets: {
        messages: Set<MessageModel>,
        authors: Set<ReturnType<typeof userMention>>,
        references: Collection<Snowflake, MessageModel>
    }
}): Promise<void> {
    const { message, channel, cache, sets } = data;

    sets.messages.add(message);
    sets.authors.add(userMention(message.author_id));

    const referenceId = message.reference_id;

    if (referenceId) {
        const reference = await channel.messages.fetch(referenceId)
            .then(serializeMessage)
            .catch(() => cache.fetchMessage(referenceId));

        if (reference) sets.references.set(message.message_id, reference);
    }
}