import { Events, Guild } from "discord.js";

import EventListener from "../handlers/listeners/eventListener";
import Config from "../utils/config";

export default class GuildCreateEventListener extends EventListener {
    constructor() {
        super(Events.GuildCreate);
    }

    execute(guild: Guild): void {
        Config.create(guild.id, {});
    }
}