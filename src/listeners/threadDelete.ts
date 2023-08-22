import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, ThreadChannel, userMention } from "discord.js";
import { LoggingEvent } from "../types/config";
import { sendLog } from "../utils/logging";

import EventListener from "../handlers/listeners/eventListener";

export default class ThreadDeleteEventListener extends EventListener {
    constructor() {
        super(Events.ThreadDelete);
    }

    async execute(thread: ThreadChannel): Promise<void> {
        if (thread.partial) thread = await thread.fetch();

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

        await sendLog({
            event: LoggingEvent.Thread,
            channel: thread.parent as GuildTextBasedChannel,
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