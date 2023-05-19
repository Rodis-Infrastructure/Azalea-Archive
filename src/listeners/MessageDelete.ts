import { Events, Message } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import { cacheMessage } from "../utils/Cache";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageDelete);
    }

    async execute(message: Message): Promise<void> {
        cacheMessage(message.id, { deleted: true });
    }
}