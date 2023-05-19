import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import { sendLog } from "../utils/LoggingUtils";
import { LoggingEvent } from "../utils/Types";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageUpdate);
    }

    async execute(oldMessage: Message, newMessage: Message): Promise<void> {
        if (oldMessage.partial) await oldMessage.fetch();
        if (newMessage.partial) await newMessage.fetch();
        if (newMessage.author.bot) return;

        const MAX_CONTENT_LENGTH = 900;
        const oldLengthDiff = oldMessage.content.length - MAX_CONTENT_LENGTH;
        const newLengthDiff = newMessage.content.length - MAX_CONTENT_LENGTH;

        const oldContent = oldLengthDiff > 0
            ? `${oldMessage.content.slice(0, MAX_CONTENT_LENGTH)}...(${oldLengthDiff} more characters)`
            : oldMessage.content;

        const newContent = newLengthDiff > 0
            ? `${newMessage.content.slice(0, MAX_CONTENT_LENGTH)}...(${newLengthDiff} more characters)`
            : newMessage.content;

        const channel = newMessage.channel as GuildTextBasedChannel;
        const log = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle("Message Edited")
            .setFields([
                {
                    name: "Author",
                    value: `${newMessage.author} (\`${newMessage.author.id}\`)`
                },
                {
                    name: "Channel",
                    value: `${channel} (\`#${channel.name}\`)`
                },
                {
                    name: "Before",
                    value: `\`\`\`${oldContent}\`\`\``
                },
                {
                    name: "After",
                    value: `\`\`\`${newContent}\`\`\``
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