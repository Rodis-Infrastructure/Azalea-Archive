import { Events } from "discord.js";

export default abstract class EventListener {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: { name: Events; once: boolean; }) {}
}