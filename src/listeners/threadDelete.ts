import { Colors, EmbedBuilder, Events, ThreadChannel, userMention } from "discord.js";
import { LoggingEvent } from "../types/config";

import EventListener from "../handlers/listeners/eventListener";

export default class ThreadDeleteEventListener extends EventListener {
    constructor() {
        super(Events.ThreadDelete);
    }

    async execute(thread: ThreadChannel): Promise<void> {
        const log = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: "Thread Deleted", iconURL: "attachment://messageDelete.png" })
            .setFields([
                {
                    name: "Owner",
                    value: `${userMention(thread.ownerId!)} (\`${thread.ownerId}\`)`
                },
                {
                    name: "Thread",
                    value: `\`#${thread.name}\``
                },
                {
                    name: "Parent Channel",
                    value: `${thread.parent} (\`#${thread.parent!.name}\`)`
                }
            ])
            .setFooter({ text: `Thread ID: ${thread.id}` })
            .setTimestamp();

        await log({
            event: LoggingEvent.Thread,
            channelId: thread.parentId as string,
            guildId: thread.guildId,
            categoryId: thread.parent?.parentId,
            options: {
                embeds: [log],
                files: [{
                    name: "messageDelete.png",
                    attachment: "./icons/messageDelete.png"
                }]
            }
        });
    }
}