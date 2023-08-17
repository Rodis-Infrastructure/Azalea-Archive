import { processCachedMessages } from "../utils/cache";
import { readdir, readFile } from "node:fs/promises";
import { ConfigData } from "../types/config";
import { parse } from "@iarna/toml";
import { Colors, EmbedBuilder, Events, GuildTextBasedChannel } from "discord.js";
import { runQuery } from "../db";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";
import Config from "../utils/config";
import ms from "ms";
import { RequestType } from "../types/utils";

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

            await Promise.all([
                setBanRequestNoticeInterval(config, guildId),
                setMuteRequestNoticeInterval(config, guildId)
            ]);
        }

        await Promise.all([
            ClientManager.selections.load(),
            ClientManager.buttons.load(),
            ClientManager.modals.load(),
            ClientManager.commands.load()
        ]);

        await ClientManager.commands.publish();

        setInterval(async() => {
            await processCachedMessages();
        }, ms("30m"));

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

async function setBanRequestNoticeInterval(config: ConfigData, guildId: string) {
    if (!config.channels?.banRequestQueue || !config.banRequestNotices?.enabled) return;

    setInterval(async() => {
        const cachedBanRequests = ClientManager.cache.requests.filter(r => r.requestType === RequestType.Ban);
        if (cachedBanRequests.size < config.banRequestNotices!.threshold) return;

        const channel = await ClientManager.client.channels.fetch(config.banRequestNotices!.channelId) as GuildTextBasedChannel;
        const rolesToMention = config.banRequestNotices!.mentionedRoles?.map(role => `<@&${role}>`);
        const jumpUrl = `https://discord.com/channels/${guildId}/${config.channels!.banRequestQueue}/${cachedBanRequests.lastKey()}`;

        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`${cachedBanRequests.size} Unhandled Ban Requests`)
            .setDescription(`There are currently ${cachedBanRequests.size} unhandled ban requests starting from [here](${jumpUrl})`)
            .setTimestamp();

        channel.send({
            content: rolesToMention?.join(" "),
            embeds: [embed]
        });
    }, config.banRequestNotices.interval);
}

async function setMuteRequestNoticeInterval(config: ConfigData, guildId: string) {
    if (!config.channels?.muteRequestQueue || !config.muteRequestNotices?.enabled) return;

    setInterval(async() => {
        const cachedMuteRequests = ClientManager.cache.requests.filter(r => r.requestType === RequestType.Mute);
        if (cachedMuteRequests.size < config.muteRequestNotices!.threshold) return;

        const channel = await ClientManager.client.channels.fetch(config.muteRequestNotices!.channelId) as GuildTextBasedChannel;
        const rolesToMention = config.muteRequestNotices!.mentionedRoles?.map(role => `<@&${role}>`);
        const jumpUrl = `https://discord.com/channels/${guildId}/${config.channels!.banRequestQueue}/${cachedMuteRequests.lastKey()}`;

        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`${cachedMuteRequests.size} Unhandled Mute Requests`)
            .setDescription(`There are currently ${cachedMuteRequests.size} unhandled mute requests starting from [here](${jumpUrl})`)
            .setTimestamp();

        channel.send({
            content: rolesToMention?.join(" "),
            embeds: [embed]
        });
    }, config.muteRequestNotices.interval);
}