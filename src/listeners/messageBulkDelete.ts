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
import { cacheMessage } from "../utils/cache";

import EventListener from "../handlers/listeners/eventListener";

export default class MessageBulkDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageBulkDelete);
    }

    async execute(messages: Collection<string, Message<true>>, channel: GuildTextBasedChannel): Promise<void> {
        if (!channel.guildId) return;

        const content: string[] = [];
        let authorId = messages.first()?.author.id;

        messages.forEach(message => {
            cacheMessage(message.id, { deleted: true });

            content.push(`[${message.createdAt.toLocaleString("en-GB")}] ${message.author.tag} (${message.author.id})\n${message.content}`);
            if (authorId && message.author.id !== authorId) authorId = undefined;
        });

        const file = new AttachmentBuilder(Buffer.from(content.join("\n\n")))
            .setName(`messages.txt`)
            .setDescription("Purged messages");

        const author = authorId ? ` by ${userMention(authorId)}` : "";
        const log = await sendLog({
            event: LoggingEvent.Message,
            channel,
            options: {
                content: `Purged \`${messages.size}\` messages${author} in ${channel} (\`#${channel.name}\`)`,
                allowedMentions: { parse: [] },
                files: [file]
            }
        });

        if (!log) return;

        const attachmentId = log.attachments.first()!.id;
        const jumpUrl = hyperlink("Open in browser", `https://txt.discord.website?txt=${log.channelId}/${attachmentId}/messages&raw=true`);

        await Promise.all([
            log.edit(`${log.content}\n\n${jumpUrl}`),
            linkToPurgeLog({
                channel,
                content: messages,
                url: log.url
            })
        ]);
    }
}