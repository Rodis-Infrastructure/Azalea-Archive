import { processCachedMessages } from "../utils/cache";
import { readdir, readFile } from "node:fs/promises";
import { ConfigData } from "../types/config";
import { parse } from "yaml";
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
        const { client, selections, buttons, modals, commands } = ClientManager;
        console.log(`${client.user?.tag} is online!`);

        const configFiles = await readdir("config/guilds/");

        for (const file of configFiles) {
            const guildId = file.split(".")[0];
            if (!guildId.match(/^\d{17,19}$/g)) continue;

            const configData: ConfigData = parse(await readFile(`config/guilds/${file}`, "utf-8")) ?? {};
            const config = new Config(guildId, configData).bind();

            setBanRequestNoticeInterval(configData, guildId);
            setMuteRequestNoticeInterval(configData, guildId);

            await commands.loadGuildCommands(config);
            await commands.publishGuildCommands(config);
        }

        await Promise.all([
            selections.load(),
            buttons.load(),
            modals.load(),
            commands.loadGlobalCommands()
        ]);

        await commands.publishGlobalCommands();

        setInterval(async() => {
            await processCachedMessages();
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
    if (!config.channels?.banRequestQueue || !config.banRequestNotices?.enabled) return;

    setInterval(async() => {
        const cachedBanRequests = ClientManager.cache.requests.filter(r => r.requestType === RequestType.Ban);
        if (cachedBanRequests.size < config.banRequestNotices!.threshold) return;

        const channel = await ClientManager.client.channels.fetch(config.banRequestNotices!.channelId) as GuildTextBasedChannel;
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
    }, config.banRequestNotices.interval);
}

function setMuteRequestNoticeInterval(config: ConfigData, guildId: string) {
    if (!config.channels?.muteRequestQueue || !config.muteRequestNotices?.enabled) return;

    setInterval(async() => {
        const cachedMuteRequests = ClientManager.cache.requests.filter(r => r.requestType === RequestType.Mute);
        if (cachedMuteRequests.size < config.muteRequestNotices!.threshold) return;

        const channel = await ClientManager.client.channels.fetch(config.muteRequestNotices!.channelId) as GuildTextBasedChannel;
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
    }, config.muteRequestNotices.interval);
}