import { AnyComponentInteraction } from "../../types/interactions";
import { Command, ComponentInteraction } from "./interaction";
import { client } from "../../client";
import { glob } from "fast-glob";

import Cache from "../../utils/cache";
import path from "node:path";

export async function loadInteractions() {
    const files = glob.sync("./src/interactions/**/*.ts");

    for (const file of files) {
        const interaction = (await import(path.resolve(file))).default;
        registerInteraction(new interaction());
    }
}

export async function publishCommands() {
    const data = Cache.commands.map(command => command.build());

    try {
        await client.application?.commands.set(data);
        console.log(`Successfully loaded ${Cache.commands.size} commands!`);
    } catch (err) {
        console.error(err);
    }
}

function registerInteraction(interaction: Command | ComponentInteraction<AnyComponentInteraction>): void {
    if (interaction instanceof Command) {
        Cache.commands.set(`${interaction.data.name}_${interaction.data.type}`, interaction);
        return;
    }

    Cache.interactions.set(interaction.data.name, interaction);
}