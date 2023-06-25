import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";
import { formatLogContent, linkToPurgeLog, sendLog } from "../utils/LoggingUtils";
import { cacheMessage } from "../utils/Cache";
import { LoggingEvent } from "../utils/Types";

import EventListener from "../handlers/listeners/EventListener";
import { referenceLog } from "../utils";

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
            const res = await referenceLog(message);
            embeds.unshift(res.embed);
            files.push(res.icon);
        }

        const url = await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channel
        });

        await linkToPurgeLog({
            channel,
            content: message.id,
            url
        });
    }
}