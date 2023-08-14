import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";
import { formatLogContent, linkToPurgeLog, sendLog } from "../utils/logging";
import { LoggingEvent } from "../types/config";
import { cacheMessage } from "../utils/cache";
import { referenceLog } from "../utils";

import EventListener from "../handlers/listeners/eventListener";

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
            await referenceLog(message).then(res => {
                embeds.unshift(res.embed);
                files.push(res.icon);
            });
        }

        const loggedMessage = await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channel
        }) as Message;

        await linkToPurgeLog({
            channel,
            content: message.id,
            url: loggedMessage.url
        });
    }
}