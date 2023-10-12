import { Colors, EmbedBuilder, Events, ThreadChannel, userMention } from "discord.js";
import { LoggingEvent } from "@/types/config";
import { sendLog } from "@/utils/logging";
import { capitalize } from "@/utils";

import EventListener from "@/handlers/listeners/eventListener";

export default class ThreadUpdateEventListener extends EventListener {
    constructor() {
        super(Events.ThreadUpdate);
    }

    async execute(oldThread: ThreadChannel, newThread: ThreadChannel): Promise<void> {
        if (!newThread.parent) return;

        const propertiesToCompare: (keyof ThreadChannel)[] = ["name", "archived", "locked"];
        const changes: string[] = [];

        // Compare the properties
        for (const property of propertiesToCompare) {
            const oldValue = oldThread[property];
            const newValue = newThread[property];

            if (oldValue === newValue) continue;

            changes.push(`${capitalize(property)}: \`${oldValue}\` ➔ \`${newValue}\``);
        }

        if (!changes.length) return;

        const embed = new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setAuthor({ name: "Thread Updated", iconURL: "attachment://messageUpdate.png" })
            .setFields([
                {
                    name: "Owner",
                    value: `${userMention(newThread.ownerId as string)} (\`${newThread.ownerId}\`)`
                },
                {
                    name: "Thread",
                    value: `${newThread} (\`#${newThread.name}\`)`
                },
                {
                    name: "Parent Channel",
                    value: `${newThread.parent} (\`#${newThread.parent.name}\`)`
                },
                {
                    name: "Changes",
                    value: changes.join("\n")
                }
            ])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.Thread,
            sourceChannel: newThread.parent,
            options: {
                embeds: [embed],
                files: [{
                    name: "messageUpdate.png",
                    attachment: "./icons/messageUpdate.png"
                }]
            }
        });
    }
}