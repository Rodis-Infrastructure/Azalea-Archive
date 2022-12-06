import Bot from "../../Bot";

export default class EventListener {
    once?: boolean;
    name: string;
    client: Bot;

    constructor(client: Bot, data: { name: string; once?: boolean; }) {
        this.once = data.once ?? false;
        this.name = data.name;
        this.client = client;
    }
}