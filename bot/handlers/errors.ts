import { codeBlock, Colors, EmbedBuilder, WebhookClient } from "discord.js";
import { ensureError } from "@bot/utils";

if (process.env.DEBUG_WEBHOOK_URL) {
    const webhook = new WebhookClient({ url: process.env.DEBUG_WEBHOOK_URL });

    process.on("uncaughtException", async (_error, origin) => {
        const error = ensureError(_error);
        const embed = new EmbedBuilder()
            .setTitle(origin)
            .setColor(Colors.Red)
            .setDescription(codeBlock(error.stack ?? error.message));

        await webhook.send({ embeds: [embed] });
        process.exit(1);
    });
}