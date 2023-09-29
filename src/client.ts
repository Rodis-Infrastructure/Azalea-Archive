import { Client, GatewayIntentBits, Partials } from "discord.js";
import { loadListeners } from "./handlers/listeners/loader";

import "dotenv/config";

process.on("unhandledRejection", (error: Error) => console.error(error.stack));
process.on("uncaughtException", (error: Error) => console.error(error.stack));

export const client = new Client({
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

(async() => {
    await Promise.all([
        loadListeners(),
        client.login(process.env.BOT_TOKEN)
    ]);
})();