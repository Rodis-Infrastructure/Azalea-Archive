import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";
import { formatLogContent, linkToLog, sendLog } from "../utils/LoggingUtils";
import { cacheMessage } from "../utils/Cache";
import { LoggingEvent } from "../utils/Types";

import EventListener from "../handlers/listeners/EventListener";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageDelete);
    }

    async execute(message: Message): Promise<void> {
        if (!message.guildId) return;
        cacheMessage(message.id, { deleted: true });
        if (!message.content) return;

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
                    value: formatLogContent(message.content)
                }
            ])
            .setTimestamp();

        const embeds = [log];
        const files = [{
            attachment: "./icons/messageDelete.png",
            name: "messageDelete.png"
        }];

        if (message.reference) {
            const reference = await message.fetchReference();
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

        const url = await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channel
        });

        await linkToLog({
            channel,
            content: message.id,
            url
        });
    }
}