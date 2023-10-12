import { Colors, EmbedBuilder, Events, hyperlink, messageLink, roleMention } from "discord.js";
import { loadInteractions, publishCommands } from "@/handlers/interactions/loader";
import { isGuildTextBasedChannel, RegexPatterns } from "@/utils";
import { readFile } from "node:fs/promises";
import { ConfigData } from "@/types/config";
import { Requests } from "@/types/requests";
import { runQuery } from "@database/utils";
import { client } from "@/client";
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
            const { id } = RegexPatterns.Snowflake.exec(filepath)?.groups ?? {};
            RegexPatterns.Snowflake.lastIndex = 0;

            if (!id) continue;

            const fileContent = await readFile(filepath, "utf-8");
            const data: ConfigData = parse(fileContent) ?? {};
            const config = Config.create(id, data);

            await Promise.all([
                setBanRequestNoticeInterval(config),
                setMuteRequestNoticeInterval(config)
            ]);
        }

        await loadInteractions();
        await publishCommands();

        setInterval(async() => {
            await Cache.storeMessages();
        }, ms("10m"));

        // Remove old data from the database (older than 24 hours)
        setInterval(async() => {
            await runQuery(`
                DELETE
                FROM messages
                WHERE ${Date.now()} - created_at > ${ms("24h")}
            `);
        }, ms("3h"));
    }
}

async function setBanRequestNoticeInterval(config: Config): Promise<void> {
    if (!config.channels.banRequestQueue || !config.banRequestNotices?.enabled) return;

    const { threshold, channelId, interval, mentionedRoles } = config.banRequestNotices;

    const cache = Cache.get(config.guildId);
    const channel = await client.channels.fetch(channelId);
    const mentions = mentionedRoles?.map(roleId => roleMention(roleId));

    if (!channel || !isGuildTextBasedChannel(channel)) {
        throw new Error("Invalid ban request queue channel");
    }

    setInterval(async() => {
        const cachedBanRequests = cache.requests.filter(request => request.requestType === Requests.Ban);

        if (cachedBanRequests.size < threshold) return;

        const jumpURL = messageLink(config.channels.banRequestQueue!, cachedBanRequests.lastKey()!, config.guildId);
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`${cachedBanRequests.size} Unhandled Ban Requests`)
            .setDescription(`There are currently ${cachedBanRequests.size} unhandled ban requests starting from ${hyperlink("here", jumpURL)}`)
            .setTimestamp();

        await channel.send({
            content: mentions?.join(" "),
            embeds: [embed]
        });
    }, interval);
}

async function setMuteRequestNoticeInterval(config: Config): Promise<void> {
    if (!config.channels.muteRequestQueue || !config.muteRequestNotices?.enabled) return;

    const { threshold, channelId, interval, mentionedRoles } = config.muteRequestNotices;

    const cache = Cache.get(config.guildId);
    const channel = await client.channels.fetch(channelId);
    const mentions = mentionedRoles?.map(roleId => roleMention(roleId));

    if (!channel || !isGuildTextBasedChannel(channel)) {
        throw new Error("Invalid mute request queue channel");
    }

    setInterval(async() => {
        const cachedMuteRequests = cache.requests.filter(request => request.requestType === Requests.Mute);

        if (cachedMuteRequests.size < threshold) return;

        const jumpURL = messageLink(config.channels.muteRequestQueue!, cachedMuteRequests.lastKey()!, config.guildId);
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`${cachedMuteRequests.size} Unhandled Mute Requests`)
            .setDescription(`There are currently ${cachedMuteRequests.size} unhandled mute requests starting from ${hyperlink("here", jumpURL)}`)
            .setTimestamp();

        await channel.send({
            content: mentions?.join(" "),
            embeds: [embed]
        });
    }, interval);
}