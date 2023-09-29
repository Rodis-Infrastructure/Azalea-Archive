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
import { client } from "../client";

import Cache from "./cache";
import Config from "./config";

export async function sendLog(data: LogData): Promise<Message<true> | void> {
    const { event, channelId, guildId, options, categoryId } = data;

    const config = Config.get(guildId)!;
    if (channelId && !config?.loggingAllowed(event, channelId, categoryId || undefined)) return;

    const loggingChannelId = config?.loggingChannel(event);
    if (!loggingChannelId) throw `Channel ID for event ${event} not configured.`;

    const loggingChannel = await client.channels.fetch(loggingChannelId) as GuildTextBasedChannel;

    if (!loggingChannel) throw `Logging channel for event ${event} not found.`;
    return loggingChannel.send(options);
}

export async function linkToPurgeLog(params: {
    guildId: string,
    content: string | MessageModel[],
    url: string | void
}) {
    const { url, content, guildId } = params;

    const cache = Cache.get(guildId);
    if (!cache.messages.purged) return;

    const { data, moderatorId, targetId } = cache.messages.purged;

    if (typeof content === "string" && !data.includes(content)) return;
    if (typeof content !== "string" && !content.some(({ message_id }) => data.includes(message_id))) return;

    const config = Config.get(guildId)!;

    if (!url) {
        await config.sendConfirmation({
            message: `${config.emojis.error} ${userMention(moderatorId)} failed to retrieve the log's URL`,
            full: true
        });

        cache.messages.purged = undefined;
        return;
    }

    const amount = typeof content === "string" ? 1 : content.length;
    const author = targetId
        ? ` by <@${targetId}> (\`${targetId}\`)`
        : "";

    await config.sendConfirmation({
        message: `purged \`${amount}\` ${pluralize("message", amount)}${author}: ${url}`,
        authorId: moderatorId,
        allowMentions: true
    });

    cache.messages.purged = undefined;
}

export function formatLogContent(content: string | null): string {
    if (!content) return "No message content.";

    let formatted = content.replaceAll("```", "\\`\\`\\`");
    formatted = elipsify(formatted, 1000);

    return codeBlock(formatted);
}

export function createReferenceLog(reference: MessageModel, options: {
    referenceDeleted: boolean
}): { embed: EmbedBuilder, file: AttachmentPayload } {
    const referenceURL = `https://discord.com/channels/${reference.guild_id}/${reference.channel_id}/${reference.message_id}`;
    const referenceLog = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setAuthor({
            name: "Reference",
            iconURL: "attachment://reply.png"
        })
        .setFields([
            {
                name: "Author",
                value: userMention(reference.author_id)
            },
            {
                name: "Content",
                value: formatLogContent(reference.content)
            }
        ]);

    if (!options.referenceDeleted) referenceLog.setDescription(hyperlink("Jump to message", referenceURL));

    return {
        embed: referenceLog,
        file: { attachment: "./icons/reply.png", name: "reply.png" }
    };
}