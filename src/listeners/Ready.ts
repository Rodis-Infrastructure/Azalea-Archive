import { processCachedMessages } from "../utils/Cache";
import { readdir, readFile } from "node:fs/promises";
import { ConfigData } from "../utils/Types";
import { removeExpiredData } from "../db";
import { parse } from "@iarna/toml";
import { Events } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";
import Config from "../utils/Config";
import ms from "ms";

export default class ReadyEventListener extends EventListener {
    constructor() {
        super(Events.ClientReady, {
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

        setInterval(async() => {
            await processCachedMessages();
        }, ms("15m"));

        setInterval(async() => {
            await removeExpiredData();
        }, ms("6h"));
    }
}