import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";

import { readFile, readdir } from "node:fs/promises";
import { GuildConfig } from "../utils/Types";
import { parse } from "@iarna/toml";

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

            const config: GuildConfig = parse(await readFile(`config/guilds/${file}`, "utf-8")) ?? {};
            ClientManager.guildConfigs.set(guildId, config);
        }

        await ClientManager.selectMenus.load();
        await ClientManager.buttons.load();
        await ClientManager.modals.load();

        await ClientManager.commands.load();
        await ClientManager.commands.publish();
    }
}
