import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";
import { linkToLog, sendLog } from "../utils/LoggingUtils";
import { cacheMessage } from "../utils/Cache";
import { LoggingEvent } from "../utils/Types";

import EventListener from "../handlers/listeners/EventListener";

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
            .setAuthor({ name: "Message Deleted", iconURL: "attachment://messageDelete.png" })
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

        const url = await sendLog({
            event: LoggingEvent.Message,
            channel,
            options: {
                embeds: [log],
                files: [{
                    attachment: "./icons/messageDelete.png",
                    name: "messageDelete.png"
                }]
            }
        });

        await linkToLog({
            channel,
            content: message.id,
            url
        });
    }
}