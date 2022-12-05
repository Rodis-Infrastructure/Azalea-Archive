import Bot from "../../Bot";

export default class EventListener {
    client: Bot;
    name: string;
    once?: boolean;

    constructor(client: Bot, data: { name: string; once?: boolean; }) {
        this.client = client;
        this.name = data.name;
        this.once = data.once ?? false;
    }
}