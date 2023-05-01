import { parse } from "@iarna/toml";
import { Events } from "discord.js";

import { readdir, readFile } from "node:fs/promises";
import ClientManager from "../Client";
import EventListener from "../handlers/listeners/EventListener";
import Config from "../utils/Config";
import { ConfigData } from "../utils/Types";

export default class ReadyEventListener extends EventListener {
    constructor() {
        super({
            name: Events.ClientReady,
            once: true
        });
    }

    async execute(): Promise<void> {
        console.log(`${ClientManager.client.user?.tag} is online!`);
        const configFiles = await readdir("config/guilds/");

        for (const file of configFiles) {
            const guildId = file.split(".")[0];
            if (!guildId.match(/^\d{17,19}$/g)) continue;

            const config: ConfigData = parse(await readFile(`config/guilds/${file}`, "utf-8")) ?? {};
            new Config(config).bind(guildId);
        }

        await Promise.all([
            ClientManager.selections.load(),
            ClientManager.buttons.load(),
            ClientManager.modals.load(),
            ClientManager.commands.load()
        ]);

        await ClientManager.commands.publish();
    }
}