import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, ThreadChannel, userMention } from "discord.js";
import { LoggingEvent } from "../types/config";
import { sendLog } from "../utils/logging";

import EventListener from "../handlers/listeners/eventListener";

export default class ThreadCreateEventListener extends EventListener {
    constructor() {
        super(Events.ThreadCreate);
    }

    async execute(thread: ThreadChannel, newlyCreated: boolean): Promise<void> {
        if (!newlyCreated) return;
        if (thread.partial) thread = await thread.fetch();

        const log = new EmbedBuilder()
            .setColor(Colors.Green)
            .setAuthor({ name: "Thread Created" })
            .setFields([
                {
                    name: "Owner",
                    value: `${userMention(thread.ownerId!)} (\`${thread.ownerId}\`)`
                },
                {
                    name: "Thread",
                    value: `${thread} (\`#${thread.name}\`)`
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
                embeds: [log]
            }
        });
    }
}