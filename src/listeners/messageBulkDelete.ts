import {
    AttachmentBuilder,
    Collection,
    Events,
    GuildTextBasedChannel,
    hyperlink,
    Message,
    userMention
} from "discord.js";

import { linkToPurgeLog, sendLog } from "../utils/logging";
import { LoggingEvent } from "../types/config";
import { processBulkDeletedMessages } from "../utils/cache";

import EventListener from "../handlers/listeners/eventListener";
import { serializeMessageToDatabaseModel } from "../utils";
import { MessageModel } from "../types/db";

export default class MessageBulkDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageBulkDelete);
    }

    async execute(deletedMessages: Collection<string, Message<true>>, channel: GuildTextBasedChannel): Promise<void> {
        if (!channel.guildId) return;

        const content: string[] = [];
        const partialMessageIds: string[] = [];
        const messages: MessageModel[] = [];

        let authorId = deletedMessages.first()?.author.id;

        for (const message of deletedMessages.values()) {
            if (message.partial) {
                partialMessageIds.push(message.id);
            } else {
                content.push(`[${message.createdAt.toLocaleString("en-GB")}] ${message.author.id} — ${message.content}`);
                messages.push(serializeMessageToDatabaseModel(message, true));

                if (message.author.id !== authorId) authorId = undefined;
            }
        }

        for (const message of await processBulkDeletedMessages(partialMessageIds)) {
            const msCreatedAt = message.created_at * 1000;

            content.push(`[${msCreatedAt.toLocaleString("en-GB")}] ${message.author_id} — ${message.content}`);
            messages.push(message);

            if (message.author_id !== authorId) authorId = undefined;
        }

        if (!content.length) return;

        const file = new AttachmentBuilder(Buffer.from(content.join("\n\n")))
            .setName(`messages.txt`)
            .setDescription("Purged messages");

        // Mention the author if all messages were sent by the same user
        const author = authorId ? ` by ${userMention(authorId)}` : "";
        const log = await sendLog({
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
                content: messages,
                url: log.url
            })
        ]);
    }
}