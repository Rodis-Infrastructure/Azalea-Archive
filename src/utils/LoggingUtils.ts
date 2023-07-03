import { codeBlock, Collection, GuildTextBasedChannel, Message, userMention } from "discord.js";
import { LogData } from "./Types";

import ClientManager from "../Client";
import { elipsify, pluralize } from "./index";

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

export async function linkToPurgeLog(data: {
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

    if (!url) {
        await config.sendConfirmation({
            message: `${config.emojis.error} ${userMention(cache.moderatorId)} failed to retrieve the log's URL`,
            guild: channel.guild,
            full: true
        });

        ClientManager.cache.messages.purged = undefined;
        return;
    }

    const author = cache.targetId
        ? ` by <@${cache.targetId}> (\`${cache.targetId}\`)`
        : "";

    const amount = typeof content === "string" ? 1 : content.size;
    await config.sendConfirmation({
        message: `purged \`${amount}\` ${pluralize("message", amount)}${author}: ${url}`,
        guild: channel.guild,
        authorId: cache.moderatorId
    });

    ClientManager.cache.messages.purged = undefined;
}

export function formatLogContent(content: string): string {
    if (!content) return "No message content.";

    let formatted = content.replaceAll("```", "\\`\\`\\`");
    formatted = elipsify(formatted, 1000);

    return codeBlock(formatted);
}