import { Colors, EmbedBuilder, Events, ThreadChannel, userMention } from "discord.js";
import { LoggingEvent } from "../types/config";
import { sendLog } from "../utils/logging";

import EventListener from "../handlers/listeners/eventListener";

export default class ThreadCreateEventListener extends EventListener {
    constructor() {
        super(Events.ThreadCreate);
    }

    async execute(thread: ThreadChannel, newlyCreated: boolean): Promise<void> {
        if (!newlyCreated || !thread.parent || !thread.ownerId) return;

        const log = new EmbedBuilder()
            .setColor(Colors.Green)
            .setAuthor({ name: "Thread Created", iconURL: "attachment://messageCreate.png" })
            .setFields([
                {
                    name: "Owner",
                    value: `${userMention(thread.ownerId)} (\`${thread.ownerId}\`)`
                },
                {
                    name: "Thread",
                    value: `${thread} (\`#${thread.name}\`)`
                },
                {
                    name: "Parent Channel",
                    value: `${thread.parent} (\`#${thread.parent.name}\`)`
                }
            ])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.Thread,
            sourceChannel: thread.parent,
            options: {
                embeds: [log],
                files: [{
                    name: "messageCreate.png",
                    attachment: "./icons/messageCreate.png"
                }]
            }
        });
    }
}