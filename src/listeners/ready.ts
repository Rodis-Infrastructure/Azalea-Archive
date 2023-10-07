import { Colors, EmbedBuilder, Events, GuildTextBasedChannel } from "discord.js";
import { loadInteractions, publishCommands } from "../handlers/interactions";
import { readdir, readFile } from "node:fs/promises";
import { RequestType } from "../types/utils";
import { ConfigData } from "../types/config";
import { client } from "../client";
import { runQuery } from "../db";
import { parse } from "yaml";

import EventListener from "../handlers/listeners/eventListener";
import Config from "../utils/config";
import Cache from "../utils/cache";
import ms from "ms";

export default class ReadyEventListener extends EventListener {
    constructor() {
        super(Events.ClientReady, {
            once: true
        });
    }

    async execute(): Promise<void> {
        console.log(`${client.user?.tag} is online!`);
        const configFiles = await readdir("config/guilds/");

        for (const file of configFiles) {
            const guildId = file.split(".")[0];
            if (!guildId.match(/^\d{17,19}$/g)) continue;

            const config: ConfigData = parse(await readFile(`config/guilds/${file}`, "utf-8")) ?? {};
            Config.create(guildId, config);

            setBanRequestNoticeInterval(config, guildId);
            setMuteRequestNoticeInterval(config, guildId);
        }

        await loadInteractions();
        await publishCommands();

        setInterval(async() => {
            await Cache.storeMessages();
        }, ms("10m"));

        // Removes old data from the database
        setInterval(async() => {
            await runQuery(`
                DELETE
                FROM messages
                WHERE ${Date.now()} - created_at > ${ms("24h")}
            `);
        }, ms("3h"));
    }
}

function setBanRequestNoticeInterval(config: ConfigData, guildId: string) {
    if (!config.channels?.banRequestQueue || !config.notices?.banRequests?.enabled) return;

    const { threshold, channelId, interval } = config.notices.banRequests;
    const cache = Cache.get(guildId);

    setInterval(async() => {
        const cachedBanRequests = cache.requests.filter(r => r.requestType === RequestType.Ban);
        if (cachedBanRequests.size < threshold) return;

        const channel = await client.channels.fetch(channelId) as GuildTextBasedChannel;
        const jumpUrl = `https://discord.com/channels/${guildId}/${config.channels!.banRequestQueue}/${cachedBanRequests.lastKey()}`;

        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`${cachedBanRequests.size} Unhandled Ban Requests`)
            .setDescription(`There are currently ${cachedBanRequests.size} unhandled ban requests starting from [here](${jumpUrl})`)
            .setTimestamp();

        await channel.send({
            content: "@here",
            embeds: [embed]
        });
    }, interval);
}

function setMuteRequestNoticeInterval(config: ConfigData, guildId: string) {
    if (!config.channels?.muteRequestQueue || !config.notices?.muteRequests?.enabled) return;

    const { threshold, channelId, interval } = config.notices.muteRequests;
    const cache = Cache.get(guildId);

    setInterval(async() => {
        const cachedMuteRequests = cache.requests.filter(r => r.requestType === RequestType.Mute);
        if (cachedMuteRequests.size < threshold) return;

        const channel = await client.channels.fetch(channelId) as GuildTextBasedChannel;
        const jumpUrl = `https://discord.com/channels/${guildId}/${config.channels!.banRequestQueue}/${cachedMuteRequests.lastKey()}`;

        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`${cachedMuteRequests.size} Unhandled Mute Requests`)
            .setDescription(`There are currently ${cachedMuteRequests.size} unhandled mute requests starting from [here](${jumpUrl})`)
            .setTimestamp();

        await channel.send({
            content: "@here",
            embeds: [embed]
        });
    }, interval);
}