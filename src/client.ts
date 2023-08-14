import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { Cache, CachedInfractions, CachedMessage, CachedRequest } from "./types/cache";
import { loadListeners } from "./handlers/listeners/loader";

import SelectMenuHandler from "./handlers/interactions/select_menus/manager";
import CommandHandler from "./handlers/interactions/commands/manager";
import ButtonHandler from "./handlers/interactions/buttons/manager";
import ModalHandler from "./handlers/interactions/modals/manager";
import Config from "./utils/config";

import "dotenv/config";

process.on("unhandledRejection", (error: Error) => console.error(error.stack));
process.on("uncaughtException", (error: Error) => console.error(error.stack));

class ClientManager {
    public configs: Collection<string, Config> = new Collection();
    public selections = new SelectMenuHandler();
    public commands = new CommandHandler();
    public buttons = new ButtonHandler();
    public modals = new ModalHandler();
    public cache: Cache = {
        activeMutes: new Collection<string, number>(),
        infractions: new Collection<string, CachedInfractions>(),
        requests: new Collection<string, CachedRequest>(),
        messages: {
            store: new Collection<string, CachedMessage>(),
            remove: new Set<string>(),
            purged: undefined
        }
    };

    public client = new Client({
        intents: [
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildBans,
            GatewayIntentBits.Guilds
        ],
        partials: [
            Partials.ThreadMember,
            Partials.GuildMember,
            Partials.Reaction,
            Partials.Channel,
            Partials.Message,
            Partials.User
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