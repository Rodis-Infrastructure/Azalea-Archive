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
                }
            ])
            .setTimestamp();

        const embedFields = [{
            name: "Content",
            value: formatLogContent(message.content)
        }];

        if (message.reference) {
            const reference = await message.fetchReference();
            embedFields.unshift({
                name: "Reference",
                value: formatLogContent(reference.content)
            });
        }

        log.addFields(embedFields);

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