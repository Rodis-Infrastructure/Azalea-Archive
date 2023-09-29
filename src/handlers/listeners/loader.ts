import { readdir } from "node:fs/promises";
import { client } from "../../client";
import { join } from "node:path";

export async function loadListeners() {
    const files = await readdir(join(__dirname, "../../listeners"));

    for (const file of files) {
        const EventListener = (await import(join(__dirname, "../../listeners", file))).default;
        const listener = new EventListener();

        if (listener.data?.once) {
            client.once(listener.name, (...args) => listener.execute(...args));
        } else {
            client.on(listener.name, (...args) => listener.execute(...args));
        }
    }
}