import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, ThreadChannel, userMention } from "discord.js";
import { LoggingEvent } from "../types/config";
import { sendLog } from "../utils/logging";
import { capitalize } from "../utils";

import EventListener from "../handlers/listeners/eventListener";

export default class ThreadUpdateEventListener extends EventListener {
    constructor() {
        super(Events.ThreadUpdate);
    }

    async execute(oldThread: ThreadChannel, newThread: ThreadChannel): Promise<void> {
        const propertiesToCheck: (keyof ThreadChannel)[] = ["name", "archived", "locked"];
        const changes = [];

        // Compare the properties
        for (const property of propertiesToCheck) {
            if (oldThread[property] === newThread[property]) continue;
            changes.push(`${capitalize(property)}: \`${oldThread[property]}\` –> \`${newThread[property]}\``);
        }

        if (!changes.length) return;

        const parent = newThread.parent as GuildTextBasedChannel;
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
                    value: `${parent} (\`#${parent.name}\`)`
                },
                {
                    name: "Changes",
                    value: changes.join("\n")
                }
            ])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.Thread,
            channel: parent,
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