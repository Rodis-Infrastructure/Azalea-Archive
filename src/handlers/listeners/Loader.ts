import {readdir} from "node:fs/promises";
import {Client} from "discord.js";
import {join} from "node:path";

export default class ListenerLoader {
    client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    public async load() {
        let files = await readdir(join(__dirname, "../../listeners"))
        files = files.filter(file => file.endsWith(".js"));

        for (const file of files) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const EventListener = require(join(__dirname, "../../listeners", file)).default;
            const listener = new EventListener(this.client);

            if (listener.once) {
                this.client.once(listener.name, (...args) => listener.execute(...args));
            } else {
                this.client.on(listener.name, (...args) => listener.execute(...args));
            }
        }
    }
}