import { Events, Guild } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";
import Config from "../utils/Config";

export default class GuildCreateEventListener extends EventListener {
    constructor() {
        super({
            name: Events.GuildCreate,
            once: true
        });
    }

    execute(guild: Guild) {
        const config = ClientManager.config(guild.id);
        if (!config) new Config({}).bind(guild.id);
    }
}