import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import { formatLogContent, sendLog } from "../utils/LoggingUtils";
import { LoggingEvent } from "../utils/Types";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageUpdate);
    }

    async execute(oldMessage: Message, newMessage: Message): Promise<void> {
        if (oldMessage.partial) await oldMessage.fetch();
        if (newMessage.partial) await newMessage.fetch();
        if (newMessage.author.bot) return;

        const channel = newMessage.channel as GuildTextBasedChannel;
        const log = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setAuthor({ name: "Message Updated", iconURL: "attachment://messageUpdate.png" })
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
                    value: formatLogContent(oldMessage.content)
                },
                {
                    name: "After",
                    value: formatLogContent(newMessage.content)
                }
            ])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.Message,
            channel,
            options: {
                embeds: [log],
                files: [{
                    attachment: "./icons/messageUpdate.png",
                    name: "messageUpdate.png"
                }]
            }
        });
    }
}