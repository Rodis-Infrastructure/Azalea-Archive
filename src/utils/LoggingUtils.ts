import { GuildTextBasedChannel } from "discord.js";
import { LogData } from "./Types";

import ClientManager from "../Client";

export async function sendLog(data: LogData): Promise<void> {
    const { event, channel, guildId, embed } = data;

    const config = ClientManager.config(channel?.guildId || guildId!);
    if (channel && !config?.loggingAllowed(event, channel)) return;

    const loggingChannelId = config?.loggingChannel(event);
    if (!loggingChannelId) return;

    const loggingChannel = await ClientManager.client.channels.fetch(loggingChannelId) as GuildTextBasedChannel;

    if (!loggingChannel) {
        console.error(`Logging channel for event ${event} not found.`);
        return;
    }

    await loggingChannel.send({ embeds: [embed] });
}