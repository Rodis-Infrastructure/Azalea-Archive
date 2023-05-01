import { GuildTextBasedChannel } from "discord.js";
import ClientManager from "../Client";
import { LogData } from "./Types";

export async function sendLog(data: LogData): Promise<void> {
    const { event, channel, guildId, embed } = data;

    const config = ClientManager.config(channel?.guildId || guildId as string);
    if (channel && !config?.canLog(event, channel)) return;

    const loggingChannelId = config?.loggingChannel(event);
    if (!loggingChannelId) return;

    const loggingChannel = await ClientManager.client.channels.fetch(loggingChannelId) as GuildTextBasedChannel;

    if (!loggingChannel) {
        console.error(`Logging channel for event ${event} not found.`);
        return;
    }

    await loggingChannel.send({ embeds: [embed] });
}