import {
    AttachmentBuilder,
    Collection,
    Events,
    GuildTextBasedChannel,
    hyperlink,
    Message,
    userMention
} from "discord.js";

import { linkToPurgeLog } from "../utils/logging";
import { LoggingEvent } from "../types/config";
import { MessageModel } from "../types/db";
import { serializeMessage } from "../db";

import EventListener from "../handlers/listeners/eventListener";
import Cache from "../utils/cache";

export default class MessageBulkDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageBulkDelete);
    }

    async execute(deletedMessages: Collection<string, Message<true>>, channel: GuildTextBasedChannel): Promise<void> {
        if (!channel.guildId) return;

        const content: string[] = [];
        const partialMessageIds: string[] = [];
        const messages: MessageModel[] = [];

        let lastAuthorId = "";
        let oneAuthor = false;

        for (const message of deletedMessages.values()) {
            if (message.partial) {
                partialMessageIds.push(message.id);
            } else {
                content.push(`[${message.createdAt.toLocaleString("en-GB")}] ${message.author.id} — ${message.content}`);
                messages.push(serializeMessage(message, true));

                if (lastAuthorId && message.author.id !== lastAuthorId) oneAuthor = false;
                lastAuthorId = message.author.id;
            }
        }

        const cache = Cache.get(channel.guildId);

        for (const message of await cache.handleBulkDeletedMessages(partialMessageIds)) {
            const msCreatedAt = message.created_at * 1000;

            content.push(`[${msCreatedAt.toLocaleString("en-GB")}] ${message.author_id} — ${message.content}`);
            messages.push(message);

            if (lastAuthorId && message.author_id !== lastAuthorId) oneAuthor = false;
            lastAuthorId = message.author_id;
        }

        if (!content.length) return;

        const file = new AttachmentBuilder(Buffer.from(content.join("\n\n")))
            .setName(`messages.txt`)
            .setDescription("Purged messages");

        // Mention the author if all messages were sent by the same user
        const author = oneAuthor && lastAuthorId ? ` by ${userMention(lastAuthorId)}` : "";
        const log = await log({
            event: LoggingEvent.Message,
            channelId: channel.id,
            categoryId: channel.parentId,
            guildId: channel.guildId,
            options: {
                content: `Purged \`${content.length}\` messages${author} in ${channel} (\`#${channel.name}\`)`,
                allowedMentions: { parse: [] },
                files: [file]
            }
        });

        if (!log) return;

        const attachmentId = log.attachments.first()!.id;
        const jumpURL = hyperlink("Open in browser", `https://txt.discord.website?txt=${log.channelId}/${attachmentId}/messages&raw=true`);

        await Promise.all([
            log.edit(`${log.content}\n\n${jumpURL}`),
            linkToPurgeLog({
                guildId: channel.guildId,
                data: messages,
                url: log.url
            })
        ]);
    }
}