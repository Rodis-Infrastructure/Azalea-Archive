import ClientManager from "../../Client";

import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function loadListeners() {
    const files = await readdir(join(__dirname, "../../listeners"));

    for (const file of files) {
        const EventListener = (await import(join(__dirname, "../../listeners", file))).default;
        const listener = new EventListener();

        if (listener.once) ClientManager.client.once(listener.name, (...args) => listener.execute(...args));
        else ClientManager.client.on(listener.name, (...args) => listener.execute(...args));
    }
}