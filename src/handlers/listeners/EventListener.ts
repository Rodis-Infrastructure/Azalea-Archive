import {Client} from "discord.js";

export default class EventListener {
    once?: boolean;
    name: string;
    client: Client;

    constructor(client: Client, data: { name: string; once?: boolean; }) {
        this.once = data.once ?? false;
        this.name = data.name;
        this.client = client;
    }
}