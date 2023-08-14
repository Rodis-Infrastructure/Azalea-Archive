import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
    Events,
    GuildTextBasedChannel,
    hyperlink,
    Message
} from "discord.js";
import { formatLogContent, sendLog } from "../utils/logging";
import { LoggingEvent } from "../types/config";
import { referenceLog } from "../utils";

import EventListener from "../handlers/listeners/eventListener";
import { RequestType } from "../types/utils";
import { validateRequest } from "../utils/moderation";
import ClientManager from "../client";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageUpdate);
    }

    async execute(oldMessage: Message<true>, newMessage: Message<true>): Promise<void> {
        if (!newMessage.guildId) return;
        if (oldMessage.partial) await oldMessage.fetch();
        if (newMessage.partial) await newMessage.fetch();

        const config = ClientManager.config(newMessage.guildId)!;

        if (newMessage.channelId === config.channels?.muteRequestQueue || newMessage.channelId === config.channels?.banRequestQueue) {
            if (newMessage.reactions.cache.some(r =>
                r.users.cache.size &&
                !r.users.cache.has(newMessage.client.user.id)
            )) return;

            const deleteButton = new ButtonBuilder()
                .setCustomId("delete")
                .setLabel("🗑")
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(deleteButton);
            const requestType = newMessage.channelId === config.channels?.muteRequestQueue
                ? RequestType.Mute
                : RequestType.Ban;

            try {
                await validateRequest({
                    requestType,
                    message: newMessage,
                    config
                });
            } catch (err) {
                const reason = err as string;
                const reaction = reason.includes("already been submitted") ? "🔄" : "⚠️";
                const existingReaction = newMessage.reactions.cache
                    .filter(r => r.me && r.emoji.name !== reaction)
                    .first();

                if (existingReaction) await existingReaction.users.remove(ClientManager.client.user?.id);

                await Promise.all([
                    newMessage.react(reaction),
                    newMessage.reply({
                        content: reason,
                        components: [actionRow],
                        allowedMentions: { parse: [] }
                    })
                ]);
            }
        }

        // Log the updated message

        if (
            newMessage.author.bot ||
            !newMessage.content ||
            !oldMessage.author ||
            newMessage.content === oldMessage.content
        ) return;

        const channel = newMessage.channel as GuildTextBasedChannel;
        const log = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setDescription(hyperlink("Jump to message", newMessage.url))
            .setAuthor({
                name: "Message Updated",
                iconURL: "attachment://messageUpdate.png"
            })
            .setFields([
                {
                    name: "Author",
                    value: `${newMessage.author} (\`${newMessage.author.id}\`)`
                },
                {
                    name: "Channel",
                    value: `${channel} (\`#${channel.name}\`)`
                },
                {
                    name: "Before",
                    value: formatLogContent(oldMessage.content)
                },
                {
                    name: "After",
                    value: formatLogContent(newMessage.content)
                }
            ])
            .setTimestamp();

        const embeds = [log];
        const files = [{
            attachment: "./icons/messageUpdate.png",
            name: "messageUpdate.png"
        }];

        if (newMessage.reference) {
            referenceLog(newMessage).then(res => {
                embeds.unshift(res.embed);
                files.push(res.icon);
            });
        }

        await sendLog({
            event: LoggingEvent.Message,
            options: { embeds, files },
            channel
        });
    }
}