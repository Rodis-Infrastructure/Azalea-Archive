import { EmbedBuilder, GuildTextBasedChannel } from "discord.js";
import { LoggingEvent } from "./Types";
import ClientManager from "../Client";

export async function sendLog(data: { event: LoggingEvent, channel: GuildTextBasedChannel, embed: EmbedBuilder }): Promise<void> {
    const { event, channel, embed } = data;
    const { guildId } = channel;

    const config = ClientManager.config(guildId);
    if (!config?.canLog(event, channel)) return;

    const loggingChannelId = config?.loggingChannel(event) as string;
    const loggingChannel = await ClientManager.client.channels.fetch(loggingChannelId) as GuildTextBasedChannel;

    if (!loggingChannel) {
        console.error(`Logging channel for event ${event} not found.`);
        return;
    }

    await loggingChannel.send({ embeds: [embed] });
}
