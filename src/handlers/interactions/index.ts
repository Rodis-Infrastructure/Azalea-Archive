import { AnyComponentInteraction } from "../../types/interactions";
import { Command, Component } from "./interaction";
import { client } from "../../client";
import { glob } from "fast-glob";

import Cache from "../../utils/cache";
import path from "node:path";

export async function loadInteractions(): Promise<void> {
    const interactionFiles = glob.sync("./src/interactions/**/*.ts");

    for (const interactionFile of interactionFiles) {
        try {
            const interactionModule = await import(path.resolve(interactionFile));
            const interactionClass = interactionModule.default;

            registerInteraction(new interactionClass());
        } catch (err) {
            console.error(`Error loading interaction from file ${interactionFile}: ${err}`);
        }
    }
}

export async function publishCommands(): Promise<void> {
    const cachedCommands = Cache.commands.map(command => command.build());

    try {
        await client.application?.commands.set(cachedCommands);
        console.log(`Successfully published ${Cache.commands.size} global commands!`);
    } catch (err) {
        console.error(`Error publishing global commands: ${err}`);
    }
}

function registerInteraction(interaction: Command | Component<AnyComponentInteraction>): void {
    if (interaction instanceof Command) {
        Cache.commands.set(`${interaction.data.name}_${interaction.data.type}`, interaction);
        return;
    }

    Cache.components.set(interaction.data.name, interaction);
}