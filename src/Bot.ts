import CommandHandler from "./handlers/interactions/commands/Manager";
import ListenerLoader from "./handlers/listeners/Loader";

import {Client, GatewayIntentBits, Partials} from "discord.js";
import "dotenv/config";

process.on("unhandledRejection", (error: Error) => console.error(error.stack));
process.on("uncaughtException", (error: Error) => console.error(error.stack));

export default class Bot extends Client {
    commands!: CommandHandler;

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
            this.commands = new CommandHandler(this);

            const listeners = new ListenerLoader(this);
            await listeners.load();

            await this.login(process.env.BOT_TOKEN);
        })();
    }
}

new Bot();