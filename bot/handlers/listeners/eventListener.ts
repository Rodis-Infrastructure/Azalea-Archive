import { Events } from "discord.js";

export default abstract class EventListener {
    // @formatter:off
    protected constructor(public name: Events, public data?: { once: boolean }) {}
    abstract execute(...args: never): Promise<void> | void;
}