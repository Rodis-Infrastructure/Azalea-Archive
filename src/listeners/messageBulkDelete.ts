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

    async execute(messages: Collection<string, Message>, channel: GuildTextBasedChannel): Promise<void> {
        if (!channel.guildId) return;

        let authorId = messages.first()?.author?.id;
        if (!messages.every(message => message.author?.id === authorId)) authorId = undefined;

        messages.forEach(message => {
            cacheMessage(message.id, { deleted: true });
        });

        const content = messages
            .map(message => `[${message.createdAt.toLocaleString("en-GB")}] ${message.author?.tag} (${message.author?.id})\n${message.content}`)
            .join("\n\n");

        const file = new AttachmentBuilder(Buffer.from(content))
            .setName(`messages.txt`)
            .setDescription("Purged messages");

        const author = authorId ? ` by ${userMention(authorId)}` : "";
        const message = await sendLog({
            event: LoggingEvent.Message,
            channel,
            options: {
                content: `Purged \`${messages.size}\` messages${author} (in ${channel})`,
                allowedMentions: { parse: [] },
                files: [file]
            }
        }) as Message;

        const attachmentId = message.attachments.first()!.id;
        const jumpUrl = hyperlink("Open in browser", `https://txt.discord.website?txt=${message.channelId}/${attachmentId}/messages&raw=true`);
        
        await Promise.all([
            message.edit(`${message.content}\n\n${jumpUrl}`),
            linkToPurgeLog({
                channel,
                content: messages,
                url: message.url
            })
        ]);
    }
}