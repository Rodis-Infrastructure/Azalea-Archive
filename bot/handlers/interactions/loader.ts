import { AnyComponentInteraction } from "@/types/interactions";
import { Command, Component } from "./interaction";
import { client } from "@/client";

import Cache from "@/utils/cache";
import glob from "fast-glob";
import path from "node:path";
import Config from "@/utils/config";
import { Snowflake } from "discord.js";

export async function loadGlobalInteractions(): Promise<void> {
    const interactionFiles = glob.sync("./bot/interactions/(components|global_commands)/*.ts");

    for (const interactionFile of interactionFiles) {
        try {
            const interactionModule = await import(path.resolve(interactionFile));
            const interactionClass = interactionModule.default;

            registerGlobalInteraction(new interactionClass());
        } catch (err) {
            console.error(`Error loading interaction from file ${interactionFile}: ${err}`);
        }
    }
}

export async function loadGuildCommands(config: Config): Promise<void> {
    const commandFiles = glob.sync("./bot/interactions/guild_commands/*.ts");

    for (const commandFile of commandFiles) {
        try {
            const commandModule = await import(path.resolve(commandFile));
            const commandClass = commandModule.default;

            registerGuildCommand(config.guildId, new commandClass(config));
        } catch (err) {
            console.error(`Error loading interaction from file ${commandFile}: ${err}`);
        }
    }
}

export async function publishGlobalCommands(): Promise<void> {
    const cachedCommands = Cache.globalCommands.map(command => command.build());

    try {
        await client.application?.commands.set(cachedCommands);
        console.log(`Successfully published ${Cache.globalCommands.size} global commands!`);
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
        console.log(`Successfully published ${Cache.guildCommands.size} guild commands! (${guildId})`);
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