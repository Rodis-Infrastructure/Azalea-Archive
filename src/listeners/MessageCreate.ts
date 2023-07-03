import { Events, Message } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import { cacheMessage } from "../utils/Cache";

export default class MessageCreateEventListener extends EventListener {
    constructor() {
        super(Events.MessageCreate);
    }

    execute(message: Message): void {
        if (!message.author.bot) cacheMessage(message);
    }
}