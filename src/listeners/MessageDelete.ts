import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, Message } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import { cacheMessage } from "../utils/Cache";
import { sendLog } from "../utils/LoggingUtils";
import { LoggingEvent } from "../utils/Types";
import ClientManager from "../Client";

export default class MessageDeleteEventListener extends EventListener {
    constructor() {
        super(Events.MessageDelete);
    }

    async execute(message: Message): Promise<void> {
        if (message.partial) await message.fetch();
        if (message.author.bot) return;

        cacheMessage(message.id, { deleted: true });

        const MAX_CONTENT_LENGTH = 900;
        const lengthDiff = message.content.length - MAX_CONTENT_LENGTH;

        const content = lengthDiff > 0
            ? `${message.content.slice(0, MAX_CONTENT_LENGTH)}...(${lengthDiff} more characters)`
            : message.content;

        const channel = message.channel as GuildTextBasedChannel;
        const log = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle("Message Deleted")
            .setFields([
                {
                    name: "Author",
                    value: `${message.author} (\`${message.author.id}\`)`
                },
                {
                    name: "Channel",
                    value: `${channel} (\`#${channel.name}\`)`
                },
                {
                    name: "Content",
                    value: `\`\`\`${content}\`\`\``
                }
            ])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.Message,
            embed: log,
            channel
        }).then(async url => {
            const cache = ClientManager.cache.messages.purged;
            if (!cache || !cache.data.includes(message.id)) return;

            const config = ClientManager.config(channel.guildId)!;
            const confirmationChannelId = config.channels.staffCommands;
            if (!confirmationChannelId) return;

            const confirmationChannel = await message.guild?.channels.fetch(confirmationChannelId) as GuildTextBasedChannel;
            if (!confirmationChannel) return;

            const author = `by <@${message.author.id}> (\`${message.author.id}\`)`;

            confirmationChannel.send(`${config.emojis.success} <@${cache.moderatorId}> Successfully purged \`1\` message ${author}: ${url}`);
            ClientManager.cache.messages.purged = undefined;
        });
    }
}