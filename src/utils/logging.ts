import { codeBlock, Colors, EmbedBuilder, hyperlink, Message, messageLink, Snowflake, userMention } from "discord.js";

import { elipsify, isGuildTextBasedChannel, pluralize } from "./index";
import { LogData, ReferenceLogData } from "../types/utils";
import { MessageModel } from "../types/db";
import { client } from "../client";

import Config from "./config";
import Cache from "./cache";

export async function sendLog(data: LogData): Promise<Message<true> | null> {
    const { event, sourceChannel, guildId, options } = data;
    const config = Config.get(sourceChannel?.guildId || guildId!);

    if (sourceChannel && !config?.isLoggingAllowed(event, sourceChannel)) return null;

    const loggingChannelId = config?.getLoggingChannel(event);
    if (!loggingChannelId) throw new Error(`Channel ID for event ${event} not configured.`);

    const loggingChannel = await client.channels.fetch(loggingChannelId);

    if (!loggingChannel || !isGuildTextBasedChannel(loggingChannel)) {
        throw new Error(`Logging channel for event ${event} not found.`);
    }

    return loggingChannel.send(options);
}

/**
 * @param {Snowflake|MessageModel[]} params.data - ID of a single message or an array of serialized messages
 * @param {string|void} params.url - Message link of the logged content
 */
export async function linkToPurgeLog(params: {
    guildId: string,
    data: Snowflake | MessageModel[],
    url: string | void
}): Promise<void> {
    const { url, data, guildId } = params;

    const cache = Cache.get(guildId);
    if (!cache.messages.purged) return;

    const { messageIds, executorId, targetId } = cache.messages.purged;

    if (typeof data === "string" && !messageIds.includes(data)) return;
    if (typeof data !== "string" && !data.some(({ message_id }) => messageIds.includes(message_id))) return;

    const config = Config.get(guildId);
    if (!config) return;

    if (!url) {
        const response = config.formatConfirmation("retrieve the log's URL", {
            success: false,
            executorId
        });

        await config.sendNotification(response, { allowMentions: true });
        delete cache.messages.purged;

        return;
    }

    const amountPurged = Number(typeof data === "string") || data.length;
    let message = `purged \`${amountPurged}\` ${pluralize("message", amountPurged)}`;

    if (targetId) message += ` by ${userMention(targetId)} (\`${targetId}\`)`;

    const formattedMessage = config.formatConfirmation(message, {
        success: true,
        executorId
    });

    await config.sendNotification(formattedMessage, { allowMentions: true });
    delete cache.messages.purged;
}

/**
 * - Escapes any code block formatting characters
 * - Wraps the content in a code block
 * - Crops the content if necessary
 *
 * @returns {string} The formatted content or "No message content." if no content is passed
 */
export function formatLogContent(content: string | null): string {
    if (!content) return "No message content.";

    let formatted = content.replaceAll("```", "\\`\\`\\`");
    formatted = elipsify(formatted, 1000);

    return codeBlock(formatted);
}

export function referenceEmbed(reference: MessageModel, deleted: boolean): ReferenceLogData {
    const jumpURL = messageLink(reference.channel_id, reference.message_id, reference.guild_id);
    const embed = new EmbedBuilder()
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

    if (!deleted) embed.setDescription(hyperlink("Jump to message", jumpURL));

    return {
        embed,
        file: {
            attachment: "./icons/reply.png",
            name: "reply.png"
        }
    };
}