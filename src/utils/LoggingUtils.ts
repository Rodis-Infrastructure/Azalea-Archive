import { codeBlock, Collection, GuildTextBasedChannel, Message } from "discord.js";
import { LogData } from "./Types";

import ClientManager from "../Client";
import { elipsify } from "./index";

export async function sendLog(data: LogData): Promise<string | void> {
    const { event, channel, guildId, options } = data;

    const config = ClientManager.config(channel?.guildId || guildId!);
    if (channel && !config?.loggingAllowed(event, channel)) return;

    const loggingChannelId = config?.loggingChannel(event);
    if (!loggingChannelId) return;

    const loggingChannel = await ClientManager.client.channels.fetch(loggingChannelId) as GuildTextBasedChannel;

    if (!loggingChannel) {
        console.error(`Logging channel for event ${event} not found.`);
        return;
    }

    const message = await loggingChannel.send(options);
    return message.url;
}

export async function linkToLog(data: {
    channel: GuildTextBasedChannel,
    content: string | Collection<string, Message>,
    url: string | void
}) {
    const { channel, url, content } = data;
    const cache = ClientManager.cache.messages.purged;

    if (!cache) return;
    if (typeof content === "string" && !cache.data.includes(content)) return;
    if (typeof content !== "string" && !content.some(({ id }) => cache.data.includes(id))) return;

    const config = ClientManager.config(channel.guildId)!;
    const confirmationChannelId = config.channels.staffCommands;
    if (!confirmationChannelId) return;

    const confirmationChannel = await channel.guild?.channels.fetch(confirmationChannelId) as GuildTextBasedChannel;
    if (!confirmationChannel) return;

    if (!url) {
        confirmationChannel.send(`${config.emojis.error} <@${cache.moderatorId}> Failed to retrieve the log's URL`);
        ClientManager.cache.messages.purged = undefined;
        return;
    }

    const author = cache.targetId
        ? ` by <@${cache.targetId}> (\`${cache.targetId}\`)`
        : "";

    const amount = typeof content === "string" ? 1 : content.size;
    const plural = amount > 1 ? "s" : "";

    confirmationChannel.send(`${config.emojis.success} <@${cache.moderatorId}> Successfully purged \`${amount}\` message${plural}${author}: ${url}`);
    ClientManager.cache.messages.purged = undefined;
}

export function formatLogContent(content: string): string {
    if (!content) return "No message content.";

    let formatted = content.replaceAll("```", "\\`\\`\\`");
    formatted = elipsify(formatted, 1000);

    return codeBlock(formatted);
}