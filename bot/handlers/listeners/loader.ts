import { AbstractInstanceType } from "@bot/types/internals.ts";
import { startProgressBar } from "@bot/utils";
import { client } from "@bot/client";

import path from "node:path";
import fs from "node:fs";
import EventListener from "@bot/handlers/listeners/eventListener.ts";

export async function loadListeners(): Promise<void> {
    const directoryPath = path.resolve(__dirname, "../../listeners");
    const paths = fs.readdirSync(directoryPath);
    const bar = startProgressBar("Loading listeners", paths.length);

    for (const filename of paths) {
        try {
            const filepath = path.resolve(__dirname, "../../listeners", filename);
            const listenerModule = await import(filepath);
            const listenerClass = listenerModule.default;
            const listener: AbstractInstanceType<typeof EventListener> = new listenerClass();

            if (listener.data?.once) {
                client.once(listener.name, (...args: unknown[]) => listener.execute(...args));
            } else {
                client.on(listener.name, (...args: unknown[]) => listener.execute(...args));
            }

            bar.increment({ filename });
        } catch (err) {
            console.error(`Failed to load listener ${filename}: ${err}`);
        }
    }
}