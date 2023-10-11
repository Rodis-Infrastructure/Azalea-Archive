import { Colors, EmbedBuilder, Events, messageLink, roleMention } from "discord.js";
import { loadInteractions, publishCommands } from "../handlers/interactions";
import { readFile } from "node:fs/promises";
import { RequestType } from "../types/utils";
import { ConfigData } from "../types/config";
import { RegexPatterns } from "../utils";
import { client } from "../client";
import { runQuery } from "../db";
import { parse } from "yaml";

import EventListener from "../handlers/listeners/eventListener";
import Config from "../utils/config";
import Cache from "../utils/cache";
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

        /** Guild configuration file names */
        const filenames = glob.sync("config/guilds/*.{yml,yaml}");

        for (const filename of filenames) {
            const [guildId] = filename.split(".");

            if (!guildId.match(RegexPatterns.Snowflake)) continue;

            const fileContent = await readFile(`config/guilds/${filename}`, "utf-8");
            const data: ConfigData = parse(fileContent) ?? {};
            const config = Config.create(guildId, data);

            await Promise.all([
                setBanRequestNoticeInterval(config, guildId),
                setMuteRequestNoticeInterval(config, guildId)
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

async function setBanRequestNoticeInterval(config: Config, guildId: string): Promise<void> {
    if (!config.channels.banRequestQueue || !config.banRequestNotices?.enabled) return;

    const { threshold, channelId, interval, mentionedRoles } = config.banRequestNotices;

    const cache = Cache.get(guildId);
    const channel = await client.channels.fetch(channelId);
    const mentions = mentionedRoles?.map(roleId => roleMention(roleId));

    if (!channel?.isTextBased() || channel?.isDMBased()) {
        throw new Error("Invalid ban request queue channel");
    }

    setInterval(async() => {
        const cachedBanRequests = cache.requests.filter(request => request.requestType === RequestType.Ban);

        if (cachedBanRequests.size < threshold) return;

        const jumpURL = messageLink(config.channels.banRequestQueue!, cachedBanRequests.lastKey()!, guildId);
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`${cachedBanRequests.size} Unhandled Ban Requests`)
            .setDescription(`There are currently ${cachedBanRequests.size} unhandled ban requests starting from [here](${jumpURL})`)
            .setTimestamp();

        await channel.send({
            content: mentions?.join(" "),
            embeds: [embed]
        });
    }, interval);
}

async function setMuteRequestNoticeInterval(config: Config, guildId: string): Promise<void> {
    if (!config.channels.muteRequestQueue || !config.muteRequestNotices?.enabled) return;

    const { threshold, channelId, interval, mentionedRoles } = config.muteRequestNotices;

    const cache = Cache.get(guildId);
    const channel = await client.channels.fetch(channelId);
    const mentions = mentionedRoles?.map(roleId => roleMention(roleId));

    if (!channel?.isTextBased() || channel?.isDMBased()) {
        throw new Error("Invalid mute request queue channel");
    }

    setInterval(async() => {
        const cachedMuteRequests = cache.requests.filter(request => request.requestType === RequestType.Mute);

        if (cachedMuteRequests.size < threshold) return;

        const jumpURL = messageLink(config.channels.muteRequestQueue!, cachedMuteRequests.lastKey()!, guildId);
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`${cachedMuteRequests.size} Unhandled Mute Requests`)
            .setDescription(`There are currently ${cachedMuteRequests.size} unhandled mute requests starting from [here](${jumpURL})`)
            .setTimestamp();

        await channel.send({
            content: mentions?.join(" "),
            embeds: [embed]
        });
    }, interval);
}