import { Colors, EmbedBuilder, Events, GuildTextBasedChannel } from "discord.js";
import { processCachedMessages } from "../utils/cache";
import { readdir, readFile } from "node:fs/promises";
import { ConfigData } from "../types/config";
import { RequestType } from "../types/utils";
import { runQuery } from "../db";
import { CronJob } from "cron";
import { parse } from "yaml";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";
import Config from "../utils/config";
import ms from "ms";

export default class ReadyEventListener extends EventListener {
    constructor() {
        super(Events.ClientReady, {
            once: true
        });
    }

    async execute(): Promise<void> {
        console.log(`${ClientManager.client.user?.tag} is online!`);
        const configFiles = await readdir("config/guilds/");

        for (const file of configFiles) {
            const guildId = file.split(".")[0];
            if (!guildId.match(/^\d{17,19}$/g)) continue;

            const config: ConfigData = parse(await readFile(`config/guilds/${file}`, "utf-8")) ?? {};
            new Config(config).bind(guildId);

            await setGuildCronJobs(config);
        }

        await Promise.all([
            ClientManager.selections.load(),
            ClientManager.buttons.load(),
            ClientManager.modals.load(),
            ClientManager.commands.load()
        ]);

        await ClientManager.commands.publish();

        // Store cached messages every 10 minutes
        new CronJob("*/10 * * * *", processCachedMessages).start();

        // Delete messages older than 24 hours every 2 hours
        new CronJob("0 */2 * * *", async() => {
            await runQuery(`
                DELETE
                FROM messages
                WHERE ${Date.now()} - created_at > ${ms("24h")}
            `);
        }).start();
    }
}

async function setGuildCronJobs(config: ConfigData) {
    const { client, cache } = ClientManager;
    const { scheduledMessages, channels, muteRequestNotices, banRequestNotices } = config;

    // Scheduled messages
    for (const data of scheduledMessages || []) {
        const channel = await client.channels.fetch(data.channelId)
            .catch(() => null) as GuildTextBasedChannel | null;

        if (!channel || !data.cron || !data.message) continue;
        new CronJob(data.cron, () => channel.send(data.message)).start();
    }

    const [
        muteRequestQueue,
        banRequestQueue,
        muteRequestNoticesChannel,
        banRequestNoticesChannel
    ] = await Promise.all([
        client.channels.fetch(channels?.muteRequestQueue ?? "").catch(() => null),
        client.channels.fetch(channels?.banRequestQueue ?? "").catch(() => null),
        client.channels.fetch(muteRequestNotices?.channelId ?? "").catch(() => null),
        client.channels.fetch(banRequestNotices?.channelId ?? "").catch(() => null)
    ]) as (GuildTextBasedChannel | null)[];

    // Mute request notices
    if (muteRequestNotices?.enabled && muteRequestQueue && muteRequestNoticesChannel) {
        new CronJob(muteRequestNotices.cron, async() => {
            const cachedMuteRequests = cache.requests.filter(r => r.requestType === RequestType.Mute);
            if (cachedMuteRequests.size < muteRequestNotices.threshold) return;

            const requestJumpURL = `https://discord.com/channels/${muteRequestQueue.guildId}/${muteRequestQueue.id}/${cachedMuteRequests.lastKey()}`;
            const requestNotice = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle(`${cachedMuteRequests.size} Unhandled Mute Requests`)
                .setDescription(`There are currently ${cachedMuteRequests.size} unhandled mute requests starting from [here](${requestJumpURL})`)
                .setTimestamp();

            await muteRequestNoticesChannel.send({
                content: "@here",
                embeds: [requestNotice]
            });
        }).start();
    }

    // Ban request notices
    if (banRequestNotices?.enabled && banRequestQueue && banRequestNoticesChannel) {
        new CronJob(banRequestNotices.cron, async() => {
            const cachedBanRequests = cache.requests.filter(r => r.requestType === RequestType.Ban);
            if (cachedBanRequests.size < banRequestNotices.threshold) return;

            const requestJumpURL = `https://discord.com/channels/${banRequestQueue.guildId}/${banRequestQueue.id}/${cachedBanRequests.lastKey()}`;
            const requestNotice = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle(`${cachedBanRequests.size} Unhandled Ban Requests`)
                .setDescription(`There are currently ${cachedBanRequests.size} unhandled ban requests starting from [here](${requestJumpURL})`)
                .setTimestamp();

            await banRequestNoticesChannel.send({
                content: "@here",
                embeds: [requestNotice]
            });
        }).start();
    }
}