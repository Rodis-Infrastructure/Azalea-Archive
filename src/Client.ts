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

const client = new Client({
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

const listeners = new ListenerLoader(client);

export const globalGuildConfigs: Collection<string, GuildConfig> = new Collection();
export const selectMenuManager = new SelectMenuHandler(client);
export const commandManager = new CommandHandler(client);
export const buttonManager = new ButtonHandler(client);
export const modalManager = new ModalHandler(client);

(async () => {
    await listeners.load();
    await client.login(process.env.BOT_TOKEN);
})();