import {Client, GatewayIntentBits, Partials} from "discord.js";
import "dotenv/config";

process.on("unhandledRejection", (error: Error) => console.error(error.stack));
process.on("uncaughtException", (error: Error) => console.error(error.stack));

export default class Bot extends Client {
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
            await this.login(process.env.BOT_TOKEN);
        })();
    }
}

new Bot();