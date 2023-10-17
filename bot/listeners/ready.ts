import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, hyperlink, messageLink, roleMention } from "discord.js";
import {
    loadGlobalInteractions,
    loadGuildCommands,
    publishGlobalCommands,
    publishGuildCommands
} from "@/handlers/interactions/loader";
import { extract, RegexPatterns } from "@/utils";
import { readFile } from "node:fs/promises";
import { ConfigData } from "@/types/config";
import { Requests } from "@/types/requests";
import { runQuery } from "@database/utils";
import { client } from "@/client";
import { CronJob } from "cron";
import { parse } from "yaml";

import EventListener from "@/handlers/listeners/eventListener";
import Config from "@/utils/config";
import Cache from "@/utils/cache";
import glob from "fast-glob";
import ms from "ms";

export default class ReadyEventListener extends EventListener {
    constructor() {
        super(Events.ClientReady, {
            once: true
        });
    }

    async execute(): Promise<void> {
        console.log(`${client.user?.tag} is online!`);

        /** Guild configuration file paths */
        const paths = glob.sync("config/*.{yml,yaml}");

        for (const filepath of paths) {
            // File name format: <guildId>.yml or <guildId>.yaml
            const { id } = extract(filepath, RegexPatterns.Snowflake);

            if (!id) continue;

            const fileContent = await readFile(filepath, "utf-8");
            const data: ConfigData = parse(fileContent) ?? {};
            const config = Config.create(id, data);

            await Promise.all([
                setGuildCronJobs(config),
                loadGuildCommands(config)
            ]);

            await publishGuildCommands(id);
        }

        await loadGlobalInteractions();
        await publishGlobalCommands();

        // Store cached messages every 10 minutes
        new CronJob("*/10 * * * *", Cache.storeMessages).start();

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

async function setGuildCronJobs(config: Config): Promise<void> {
    const { scheduledMessages, channels, notices } = config.data;

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
        client.channels.fetch(notices?.muteRequests?.channelId ?? "").catch(() => null),
        client.channels.fetch(notices?.banRequests?.channelId ?? "").catch(() => null)
    ]) as (GuildTextBasedChannel | null)[];

    const cache = Cache.get(config.guildId);

    // Mute request notices
    if (notices?.muteRequests?.enabled && muteRequestQueue && muteRequestNoticesChannel) {
        const { cron, threshold, mentionedRoles } = notices.muteRequests;

        new CronJob(cron, async() => {
            const cachedMuteRequests = cache.requests.filter(r => r.requestType === Requests.Mute);
            if (cachedMuteRequests.size < threshold) return;

            const requestJumpURL = messageLink(muteRequestQueue.id, cachedMuteRequests.lastKey()!, muteRequestQueue.guildId);
            const mentions = mentionedRoles?.map(roleId => roleMention(roleId));
            const requestNotice = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle(`${cachedMuteRequests.size} Unhandled Mute Requests`)
                .setDescription(`There are currently ${cachedMuteRequests.size} unhandled mute requests starting from ${hyperlink("here", requestJumpURL)}`)
                .setTimestamp();

            await muteRequestNoticesChannel.send({
                content: mentions?.join(" "),
                embeds: [requestNotice]
            });
        }).start();
    }

    // Ban request notices
    if (notices?.banRequests?.enabled && banRequestQueue && banRequestNoticesChannel) {
        const { cron, threshold, mentionedRoles } = notices.banRequests;

        new CronJob(cron, async() => {
            const cachedBanRequests = cache.requests.filter(r => r.requestType === Requests.Ban);
            if (cachedBanRequests.size < threshold) return;

            const requestJumpURL = messageLink(banRequestQueue.id, cachedBanRequests.lastKey()!, banRequestQueue.guildId);
            const mentions = mentionedRoles?.map(roleId => roleMention(roleId));
            const requestNotice = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle(`${cachedBanRequests.size} Unhandled Ban Requests`)
                .setDescription(`There are currently ${cachedBanRequests.size} unhandled ban requests starting from ${hyperlink("here", requestJumpURL)}`)
                .setTimestamp();

            await banRequestNoticesChannel.send({
                content: mentions?.join(" "),
                embeds: [requestNotice]
            });
        }).start();
    }
}