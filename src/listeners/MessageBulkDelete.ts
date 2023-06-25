import { AttachmentBuilder, Collection, Events, GuildTextBasedChannel, Message } from "discord.js";
import { linkToLog, sendLog } from "../utils/LoggingUtils";
import { cacheMessage } from "../utils/Cache";
import { LoggingEvent } from "../utils/Types";

import EventListener from "../handlers/listeners/EventListener";

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
            .map(message => `[${message.createdAt.toLocaleString("en-GB")}] ${message.author.tag} (${message.author.id})\n${message.content}`)
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

        await linkToLog({
            channel,
            content: messages,
            url
        });
    }
}