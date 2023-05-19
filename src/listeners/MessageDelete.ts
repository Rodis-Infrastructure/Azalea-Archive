import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import { cacheMessage } from "../utils/Cache";
import { sendLog } from "../utils/LoggingUtils";
import { LoggingEvent } from "../utils/Types";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageDelete);
    }

    async execute(message: Message): Promise<void> {
        if (message.partial) await message.fetch();
        if (message.author.bot) return;

        cacheMessage(message.id, { deleted: true });

        const MAX_CONTENT_LENGTH = 900;
        const lengthDiff = message.content.length - MAX_CONTENT_LENGTH;

        const content = lengthDiff > 0
            ? `${message.content.slice(0, MAX_CONTENT_LENGTH)}...(${lengthDiff} more characters)`
            : message.content;

        const channel = message.channel as GuildTextBasedChannel;
        const log = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle("Message Deleted")
            .setFields([
                {
                    name: "Author",
                    value: `${message.author} (\`${message.author.id}\`)`
                },
                {
                    name: "Channel",
                    value: `${channel} (\`#${channel.name}\`)`
                },
                {
                    name: "Content",
                    value: `\`\`\`${content}\`\`\``
                }
            ])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.Message,
            embed: log,
            channel
        });
    }
}