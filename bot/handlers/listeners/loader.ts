import { client } from "@/client";

import glob from "fast-glob";
import path from "node:path";

export async function loadListeners(): Promise<void> {
    const paths = glob.sync("./bot/listeners/*");

    for (const filepath of paths) {
        try {
            const listenerModule = await import(path.resolve(filepath));
            const listenerClass = listenerModule.default;
            const listener = new listenerClass();

            if (listener.data?.once) {
                client.once(listener.name, (...args) => listener.execute(...args));
                continue;
            }

            client.on(listener.name, (...args) => listener.execute(...args));
        } catch (err) {
            console.error(`Failed to load listener ${filepath}: ${err}`);
        }
    }
}