import { AttachmentBuilder, Collection, Events, GuildTextBasedChannel, Message } from "discord.js";
import { cacheMessage } from "../utils/Cache";

import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";
import { LoggingEvent } from "../utils/Types";

export default class MessageBulkDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageBulkDelete);
    }

    async execute(messages: Collection<string, Message>, channel: GuildTextBasedChannel): Promise<void> {
        messages.forEach(message => {
            cacheMessage(message.id, { deleted: true });
        });

        const config = ClientManager.config(channel.guildId)!;
        const loggingChannelId = config.loggingChannel(LoggingEvent.Message);
        if (!loggingChannelId) return;

        const loggingChannel = await channel.guild.channels.fetch(loggingChannelId) as GuildTextBasedChannel;
        if (!loggingChannel) return;

        let content = `${messages.size} Messages purged in #${channel.name} (${channel.id})\n\n`;
        content += messages
            .map(message => `[${message.createdAt.toLocaleString("en-GB")}] ${message.author.tag} (${message.author.id})\n${message.content}`)
            .join("\n\n");

        const file = new AttachmentBuilder(Buffer.from(content))
            .setName(`purged_messages_${new Date().toLocaleString("en-GB")}.txt`)
            .setDescription("Purged messages");

        loggingChannel.send({
            files: [file]
        });
    }
}