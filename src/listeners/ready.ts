import { processCachedMessages } from "../utils/cache";
import { readdir, readFile } from "node:fs/promises";
import { ConfigData } from "../types/config";
import { parse } from "yaml";
import { Events } from "discord.js";
import { runQuery } from "../db";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";
import Config from "../utils/config";
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
        }, ms("30m"));

        // Removes old data from the database
        setInterval(async() => {
            await runQuery(`
                DELETE
                FROM messages
                WHERE ${Date.now()} - created_at > ${ms("24h")}
            `);
        }, ms("3h"));
    }
}