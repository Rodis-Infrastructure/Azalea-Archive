import {
    AttachmentPayload,
    codeBlock,
    Colors,
    EmbedBuilder,
    GuildTextBasedChannel,
    hyperlink,
    Message,
    userMention
} from "discord.js";

import { elipsify, pluralize } from "./index";
import { MessageModel } from "../types/db";
import { LogData } from "../types/utils";

import ClientManager from "../client";

export async function sendLog(data: LogData): Promise<Message<true> | void> {
    const { event, channelId, guildId, options, categoryId } = data;

    const config = ClientManager.config(guildId)!;
    if (channelId && !config?.loggingAllowed(event, channelId, categoryId || undefined)) return;

    const loggingChannelId = config?.loggingChannel(event);
    if (!loggingChannelId) throw `Channel ID for event ${event} not configured.`;

    const loggingChannel = await ClientManager.client.channels.fetch(loggingChannelId) as GuildTextBasedChannel;

    if (!loggingChannel) throw `Logging channel for event ${event} not found.`;
    return loggingChannel.send(options);
}

export async function linkToPurgeLog(data: {
    guildId: string,
    content: string | MessageModel[],
    url: string | void
}) {
    const { url, content, guildId } = data;
    const cache = ClientManager.cache.messages.purged;

    if (!cache) return;
    if (typeof content === "string" && !cache.data.includes(content)) return;
    if (typeof content !== "string" && !content.some(({ message_id }) => cache.data.includes(message_id))) return;

    const config = ClientManager.config(guildId)!;

    if (!url) {
        await config.sendConfirmation({
            message: `${config.emojis.error} ${userMention(cache.moderatorId)} failed to retrieve the log's URL`,
            full: true
        });

        ClientManager.cache.messages.purged = undefined;
        return;
    }

    const amount = typeof content === "string" ? 1 : content.length;
    const author = cache.targetId
        ? ` by <@${cache.targetId}> (\`${cache.targetId}\`)`
        : "";

    await config.sendConfirmation({
        message: `purged \`${amount}\` ${pluralize("message", amount)}${author}: ${url}`,
        authorId: cache.moderatorId,
        allowMentions: true
    });

    ClientManager.cache.messages.purged = undefined;
}

export function formatLogContent(content: string): string {
    if (!content) return "No message content.";

    let formatted = content.replaceAll("```", "\\`\\`\\`");
    formatted = elipsify(formatted, 1000);

    return codeBlock(formatted);
}

export function createReferenceLog(data: {
    messageId: string,
    authorId: string,
    content: string,
    guildId: string,
    channelId: string
}): { embed: EmbedBuilder, file: AttachmentPayload } {
    const { messageId, authorId, content, guildId, channelId } = data;

    const referenceUrl = `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
    const referenceLog = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setDescription(hyperlink("Jump to message", referenceUrl))
        .setAuthor({
            name: "Reference",
            iconURL: "attachment://reply.png"
        })
        .setFields([
            {
                name: "Author",
                value: userMention(authorId)
            },
            {
                name: "Content",
                value: formatLogContent(content)
            }
        ]);

    return {
        embed: referenceLog,
        file: { attachment: "./icons/reply.png", name: "reply.png" }
    };
}