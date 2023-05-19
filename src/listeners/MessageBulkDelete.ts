import { Collection, Events, Message } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import { cacheMessage } from "../utils/Cache";

export default class MessageBulkDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageBulkDelete);
    }

    async execute(messages: Collection<string, Message>): Promise<void> {
        messages.forEach(message => {
            cacheMessage(message.id, { deleted: true });
        });
    }
}