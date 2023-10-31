import { startProgressBar } from "@bot/utils";
import { client } from "@bot/client";

import path from "node:path";
import fs from "node:fs";

export async function loadListeners(): Promise<void> {
    const dirPath = path.resolve(__dirname, "../../listeners");
    const paths = fs.readdirSync(dirPath);
    const bar = startProgressBar("Loading listeners", paths.length);

    for (const filename of paths) {
        try {
            const filepath = path.resolve(__dirname, "../../listeners", filename);
            const listenerModule = await import(filepath);
            const listenerClass = listenerModule.default;
            const listener = new listenerClass();

            if (listener.data?.once) {
                client.once(listener.name, (...args) => listener.execute(...args));
            } else {
                client.on(listener.name, (...args) => listener.execute(...args));
            }

            bar.increment({ filename });
        } catch (err) {
            console.error(`Failed to load listener ${filename}: ${err}`);
        }
    }
}