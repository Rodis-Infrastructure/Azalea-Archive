import { ClientEvents, Events } from "discord.js";

export default abstract class EventListener {
    // @formatter:off
    protected constructor(public name: Extract<Events, keyof ClientEvents>, public data?: { once: boolean }) {}
    abstract execute(...args: unknown[]): Promise<void> | void;
}