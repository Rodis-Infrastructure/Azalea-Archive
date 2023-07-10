import { AttachmentBuilder, Collection, Events, GuildTextBasedChannel, Message } from "discord.js";
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

        messages.forEach(message => {
            cacheMessage(message.id, { deleted: true });
        });

        let content = `${messages.size} Messages purged in #${channel.name} (${channel.id})\n\n`;
        content += messages
            .map(message => `[${message.createdAt.toLocaleString("en-GB")}] ${message.author?.tag} (${message.author?.id})\n${message.content}`)
            .join("\n\n");

        const file = new AttachmentBuilder(Buffer.from(content))
            .setName(`purged_messages_${new Date().toLocaleString("en-GB")}.txt`)
            .setDescription("Purged messages");

        const url = await sendLog({
            event: LoggingEvent.Message,
            channel,
            options: {
                files: [file]
            }
        });

        await linkToPurgeLog({
            channel,
            content: messages,
            url
        });
    }
}