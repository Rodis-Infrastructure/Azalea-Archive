import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, hyperlink, Message } from "discord.js";
import { formatLogContent, sendLog } from "../utils/logging";
import { LoggingEvent } from "../types/config";
import { referenceLog } from "../utils";

import EventListener from "../handlers/listeners/eventListener";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageUpdate);
    }

    async execute(oldMessage: Message, newMessage: Message): Promise<void> {
        if (!newMessage.guildId) return;
        if (oldMessage.partial) await oldMessage.fetch();
        if (newMessage.partial) await newMessage.fetch();

        if (
            newMessage.author.bot ||
            !newMessage.content ||
            !oldMessage.author ||
            newMessage.content === oldMessage.content
        ) return;

        const channel = newMessage.channel as GuildTextBasedChannel;
        const log = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setDescription(hyperlink("Jump to message", newMessage.url))
            .setAuthor({
                name: "Message Updated",
                iconURL: "attachment://messageUpdate.png"
            })
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

        const embeds = [log];
        const files = [{
            attachment: "./icons/messageUpdate.png",
            name: "messageUpdate.png"
        }];

        if (newMessage.reference) {
            referenceLog(newMessage).then(res => {
                embeds.unshift(res.embed);
                files.push(res.icon);
            });
        }

        await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channel
        });
    }
}