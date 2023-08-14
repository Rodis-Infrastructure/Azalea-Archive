import { cacheMessage } from "../utils/cache";
import { Events, Message } from "discord.js";

import EventListener from "../handlers/listeners/eventListener";

export default class MessageCreateEventListener extends EventListener {
    constructor() {
        super(Events.MessageCreate);
    }

    execute(message: Message): void {
        if (!message.author.bot) cacheMessage(message);
    }
}