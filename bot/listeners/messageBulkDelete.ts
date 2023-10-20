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
        const entries: string[] = [];
        const partialMessageIds: Snowflake[] = [];
        const messages: MessageModel[] = [];

        for (const message of deletedMessages.values()) {
            if (message.partial) {
                partialMessageIds.push(message.id);
            } else {
                entries.push(`[${message.createdAt.toLocaleString("en-GB")}] ${message.author.id} — ${message.content}`);
                messages.push(serializeMessage(message, true));
            }
        }

        const cache = Cache.get(channel.guildId);

        for (const message of await cache.handleBulkDeletedMessages(partialMessageIds)) {
            const msCreatedAt = message.created_at * 1000;

            entries.push(`[${msCreatedAt.toLocaleString("en-GB")}] ${message.author_id} — ${message.content}`);
            messages.push(message);
        }

        if (!entries.length) return;

        const file = new AttachmentBuilder(Buffer.from(entries.join("\n\n")))
            .setName(`messages.txt`)
            .setDescription("Purged messages");

        const authorIds = new Set(messages.map(m => m.author_id));
        const mentionedAuthors = Array.from(authorIds).map(id => userMention(id));

        const log = await sendLog({
            event: LoggingEvent.Message,
            sourceChannel: channel,
            options: {
                content: `Purged \`${entries.length}\` messages in ${channel} (\`#${channel.name}\`) by: ${mentionedAuthors}`,
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
                data: messages,
                url: log.url
            })
        ]);
    }
}