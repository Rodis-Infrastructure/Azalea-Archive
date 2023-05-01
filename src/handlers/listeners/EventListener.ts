import { Events } from "discord.js";

export default abstract class EventListener {
    once: boolean;
    name: Events;

    protected constructor(data: { name: Events; once: boolean; }) {
        this.once = data.once;
        this.name = data.name;
    }
}
