import SelectMenuHandler from "./handlers/interactions/select_menus/Manager";
import CommandHandler from "./handlers/interactions/commands/Manager";
import ButtonHandler from "./handlers/interactions/buttons/Manager";
import ModalHandler from "./handlers/interactions/modals/Manager";
import ListenerLoader from "./handlers/listeners/Loader";
import "dotenv/config";

import {Client, GatewayIntentBits, Partials, Collection} from "discord.js";
import {GuildConfig} from "./utils/Types";

process.on("unhandledRejection", (error: Error) => console.error(error.stack));
process.on("uncaughtException", (error: Error) => console.error(error.stack));

const listeners = new ListenerLoader();

class ClientManager {
    public guildConfigs: Collection<string, GuildConfig> = new Collection();
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
}

const manager = new ClientManager();
export default manager;

(async () => {
    await listeners.load();
    await manager.client.login(process.env.BOT_TOKEN);
})();