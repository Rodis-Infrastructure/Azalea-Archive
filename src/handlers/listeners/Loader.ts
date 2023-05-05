import { readdir } from "node:fs/promises";
import { join } from "node:path";

import ClientManager from "../../Client";

export async function loadListeners() {
    const files = await readdir(join(__dirname, "../../listeners"));

    for (const file of files) {
        const EventListener = (await import(join(__dirname, "../../listeners", file))).default;
        const listener = new EventListener();

        if (listener.data?.once) {
            ClientManager.client.once(listener.name, (...args) => listener.execute(...args));
        } else {
            ClientManager.client.on(listener.name, (...args) => listener.execute(...args));
        }
    }
}