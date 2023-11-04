import { Client, GatewayIntentBits, Partials } from "discord.js";
import { loadListeners } from "./handlers/listeners/loader";

import "@bot/handlers/errors";
import "dotenv/config";

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

(async(): Promise<void> => {
    if (!process.env.BOT_TOKEN) {
        console.error("A bot token must be specified in .env (BOT_TOKEN)");
        process.exit(0);
    }

    await loadListeners();
    await client.login(process.env.BOT_TOKEN);
})();