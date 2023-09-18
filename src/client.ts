import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { Cache, CachedRequest } from "./types/cache";
import { loadListeners } from "./handlers/listeners/loader";

import SelectMenuHandler from "./handlers/interactions/select_menus/manager";
import CommandHandler from "./handlers/interactions/commands/manager";
import ButtonHandler from "./handlers/interactions/buttons/manager";
import ModalHandler from "./handlers/interactions/modals/manager";
import Config from "./utils/config";

import "dotenv/config";
import { MessageModel } from "./types/db";

process.on("unhandledRejection", (error: Error) => console.error(error.stack));
process.on("uncaughtException", (error: Error) => console.error(error.stack));

class ClientManager {
    configs: Collection<string, Config> = new Collection();
    selections = new SelectMenuHandler();
    commands = new CommandHandler();
    buttons = new ButtonHandler();
    modals = new ModalHandler();
    cache: Cache = {
        requests: new Collection<string, CachedRequest>(),
        messages: {
            store: new Collection<string, MessageModel>()
        }
    };

    client = new Client({
        intents: [
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.Guilds
        ],
        partials: [
            Partials.Message
        ]
    });

    config(guildId: string): Config | undefined {
        return this.configs.get(guildId);
    }
}

const manager = new ClientManager();
export default manager;

(async() => {
    await Promise.all([
        loadListeners(),
        manager.client.login(process.env.BOT_TOKEN)
    ]);
})();