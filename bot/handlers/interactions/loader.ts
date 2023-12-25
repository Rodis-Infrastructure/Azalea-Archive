import { AbstractInstanceType } from "@bot/types/internals.ts";
import { AnyComponentInteraction } from "@bot/types/interactions";
import { Command, Component } from "./interaction";
import { startProgressBar } from "@bot/utils";
import { Snowflake } from "discord.js";
import { client } from "@bot/client";

import Cache from "@bot/utils/cache";
import glob from "fast-glob";
import path from "node:path";
import Config from "@bot/utils/config";
import fs from "node:fs";

export async function loadGlobalInteractions(): Promise<void> {
    const directoryPath = path.resolve(__dirname, "../../interactions");
    const filepaths = glob.sync(`${directoryPath}/{components,global_commands}/*`);
    const bar = startProgressBar("Loading global interactions", filepaths.length);

    for (const filepath of filepaths) {
        try {
            // Get the last element of the array, which is the filename
            const filename = filepath.split("/").at(-1);
            const interactionModule = await import(filepath);
            const interactionClass = interactionModule.default;
            const interaction: AbstractInstanceType<typeof Command> = new interactionClass();

            registerGlobalInteraction(interaction);
            bar.increment({ filename });
        } catch (err) {
            console.error(`Error loading global interaction from file ${filepath}: ${err}`);
        }
    }
}

export async function loadGuildCommands(config: Config): Promise<void> {
    const directoryPath = path.resolve(__dirname, "../../interactions/guild_commands");
    const filenames = fs.readdirSync(directoryPath);
    const bar = startProgressBar(`Loading guild commands — ${config.guildId}`, filenames.length);

    for (const filename of filenames) {
        try {
            const filepath = path.resolve(__dirname, "../../interactions/guild_commands", filename);
            const commandModule = await import(filepath);
            const commandClass = commandModule.default;
            const command: AbstractInstanceType<typeof Command> = new commandClass(config);

            registerGuildCommand(config.guildId, command);
            bar.increment({ filename });
        } catch (err) {
            console.error(`Error loading guild command from file ${filename}: ${err}`);
        }
    }
}

export async function publishGlobalCommands(): Promise<void> {
    const cachedCommands = Cache.globalCommands.map(command => command.build());

    try {
        await client.application?.commands.set(cachedCommands);
        console.log(`Successfully published ${cachedCommands.length} global commands!`);
    } catch (err) {
        console.error(`Error publishing global commands: ${err}`);
    }
}

export async function publishGuildCommands(guildId: Snowflake): Promise<void> {
    const cachedCommands = Cache.guildCommands
        .filter((_, key) => key.includes(guildId))
        .map(command => command.build());

    try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        await guild.commands.set(cachedCommands);
        console.log(`Successfully published ${cachedCommands.length} guild commands! (${guildId})`);
    } catch (err) {
        console.error(`Error publishing guild commands into ${guildId}: ${err}`);
    }
}

function registerGlobalInteraction(interaction: Command | Component<AnyComponentInteraction<"cached">>): void {
    if (interaction instanceof Command) {
        Cache.globalCommands.set(`${interaction.data.name}_${interaction.data.type}`, interaction);
        return;
    }

    Cache.components.set(interaction.data.name, interaction);
}

function registerGuildCommand(guildId: Snowflake, command: Command): void {
    Cache.guildCommands.set(`${command.data.name}_${command.data.type}_${guildId}`, command);
}