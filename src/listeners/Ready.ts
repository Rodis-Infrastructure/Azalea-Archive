import EventListener from "../handlers/listeners/EventListener";
import {parse} from "yaml";

import {selectMenuManager, commandManager, buttonManager, modalManager, globalGuildConfigs} from "../Client";
import {readFileSync} from "node:fs";
import {Client} from "discord.js";

export default class ReadyEventListener extends EventListener {
    constructor(client: Client) {
        super(client, {
            name: "ready",
            once: true
        });
    }

    async execute(client: Client): Promise<void> {
        console.log(`${client.user?.tag} is online!`);
        const guilds = await client.guilds.fetch();

        for (const [guildId] of guilds) {
            const config = parse(readFileSync(`config/guilds/${guildId}.yaml`, "utf-8"));
            globalGuildConfigs.set(guildId, config);
        }

        await selectMenuManager.load();
        await buttonManager.load();
        await modalManager.load();

        await commandManager.load();
        await commandManager.publish();
    }
};