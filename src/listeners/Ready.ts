import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";

import { readFile, readdir } from "node:fs/promises";
import { ConfigData } from "../utils/Types";
import { parse } from "@iarna/toml";
import Config from "../utils/Config";

export default class ReadyEventListener extends EventListener {
    constructor() {
        super({
            name: "ready",
            once: true
        });
    }

    async execute(): Promise<void> {
        console.log(`${ClientManager.client.user?.tag} is online!`);
        const configFiles = await readdir("config/guilds/");

        for (const file of configFiles) {
            const guildId = file.split(".")[0];
            if (guildId === "example") continue;

            const config: ConfigData = parse(await readFile(`config/guilds/${file}`, "utf-8")) ?? {};
            new Config(guildId, config).save();
        }

        await ClientManager.selectMenus.load();
        await ClientManager.buttons.load();
        await ClientManager.modals.load();

        await ClientManager.commands.load();
        await ClientManager.commands.publish();
    }
}
