import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import { formatLogContent, sendLog } from "../utils/LoggingUtils";
import { LoggingEvent } from "../utils/Types";

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
            .setAuthor({
                name: "Message Updated",
                iconURL: "attachment://messageUpdate.png",
                url: newMessage.url
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
            const reference = await newMessage.fetchReference();
            const referenceData = new EmbedBuilder()
                .setColor(Colors.NotQuiteBlack)
                .setAuthor({
                    name: "Reference",
                    iconURL: "attachment://reply.png",
                    url: reference.url
                })
                .setFields([
                    {
                        name: "Author",
                        value: `${reference.author} (\`${reference.author.id}\`)`
                    },
                    {
                        name: "Content",
                        value: formatLogContent(reference.content)
                    }
                ]);

            embeds.unshift(referenceData);
            files.push({
                attachment: "./icons/reply.png",
                name: "reply.png"
            });
        }

        await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channel
        });
    }
}