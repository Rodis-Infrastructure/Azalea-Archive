import SelectMenuHandler from "./handlers/interactions/select_menus/Manager";
import CommandHandler from "./handlers/interactions/commands/Manager";
import ButtonHandler from "./handlers/interactions/buttons/Manager";
import ModalHandler from "./handlers/interactions/modals/Manager";
import "dotenv/config";

import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { loadListeners } from "./handlers/listeners/Loader";
import Config from "./utils/Config";

process.on("unhandledRejection", (error: Error) => console.error(error.stack));
process.on("uncaughtException", (error: Error) => console.error(error.stack));

class ClientManager {
    public configs: Collection<string, Config> = new Collection();
    public selectMenus = new SelectMenuHandler();
    public commands = new CommandHandler();
    public buttons = new ButtonHandler();
    public modals = new ModalHandler();

    public client = new Client({
        intents: [
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildBans,
            GatewayIntentBits.Guilds
        ],
        partials: [
            Partials.ThreadMember,
            Partials.GuildMember,
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
    await loadListeners();
    await manager.client.login(process.env.BOT_TOKEN);
})();
