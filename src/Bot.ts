import SelectMenuHandler from "./handlers/interactions/select_menus/Manager";
import CommandHandler from "./handlers/interactions/commands/Manager";
import ButtonHandler from "./handlers/interactions/buttons/Manager";
import ModalHandler from "./handlers/interactions/modals/Manager";
import ListenerLoader from "./handlers/listeners/Loader";

import {Client, GatewayIntentBits, Partials} from "discord.js";
import "dotenv/config";

process.on("unhandledRejection", (error: Error) => console.error(error.stack));
process.on("uncaughtException", (error: Error) => console.error(error.stack));

export default class Bot extends Client {
    select_menus!: SelectMenuHandler;
    commands!: CommandHandler;
    buttons!: ButtonHandler;
    modals!: ModalHandler;

    constructor() {
        super({
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

        (async () => {
            this.select_menus = new SelectMenuHandler(this);
            this.commands = new CommandHandler(this);
            this.buttons = new ButtonHandler(this);
            this.modals = new ModalHandler(this);

            const listeners = new ListenerLoader(this);
            await listeners.load();

            await this.login(process.env.BOT_TOKEN);
        })();
    }
}

new Bot();