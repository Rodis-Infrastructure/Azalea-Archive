import { Events } from "discord.js";

export default abstract class EventListener {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public name: Events, public data?: { once: boolean }) {}
}