import {
    Colors,
    EmbedBuilder,
    Events,
    Guild,
    GuildTextBasedChannel,
    hyperlink,
    messageLink,
    roleMention
} from "discord.js";

import {
    loadGlobalInteractions,
    loadGuildCommands,
    publishGlobalCommands,
    publishGuildCommands
} from "@bot/handlers/interactions/loader.ts";

import { TemporaryRole } from "@database/models/temporaryRole";
import { setTemporaryRoleTimeout } from "@bot/utils/requests";
import { extract, isGuildTextBasedChannel, RegexPatterns } from "@bot/utils";
import { readFile } from "node:fs/promises";
import { ConfigData } from "@bot/types/config";
import { Requests } from "@bot/types/requests";
import { client } from "@bot/client";
import { db } from "@database/utils.ts";
import { CronJob } from "cron";
import { parse } from "yaml";

import EventListener from "@bot/handlers/listeners/eventListener";
import Config from "@bot/utils/config";
import Cache from "@bot/utils/cache";
import glob from "fast-glob";
import ms from "ms";


export default class ReadyEventListener extends EventListener {
    constructor() {
        super(Events.ClientReady, {
            once: true
        });
    }

    async execute(): Promise<void> {
        console.log(`${client.user?.tag} is online!\n`);

        /** Guild configuration file paths */
        const paths = glob.sync("config/*.{yaml,yml}");

        for (const filepath of paths) {
            // File name format: <guildId>.yml or <guildId>.yaml
            const { id } = extract(filepath, RegexPatterns.Snowflake);

            if (!id) continue;

            const fileContent = await readFile(filepath, "utf-8");
            const data: ConfigData = parse(fileContent) ?? {};
            const config = Config.create(id, data);
            const guild = await client.guilds.fetch(id).catch(() => null);

            if (guild) await setTemporaryRoleTimeouts(guild, config);

            await Promise.all([
                setRequestNoticeCronJob(config),
                loadGuildCommands(config)
            ]);

            await publishGuildCommands(id);
        }

        await loadGlobalInteractions();
        await publishGlobalCommands();

        // Store cached messages every 10 minutes
        new CronJob("*/10 * * * *", Cache.storeMessages).start();

        // Delete messages older than 12 days every 6 hours
        new CronJob("0 */6 * * *", () => {
            db.run(`
                DELETE
                FROM messages
                WHERE $now - created_at > $timeout
            `, [{
                $now: Date.now(),
                $timeout: ms("12d")
            }]);
        }).start();
    }
}

async function setRequestNoticeCronJob(config: Config): Promise<void> {
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

        new CronJob(cron, async () => {
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

        new CronJob(cron, async () => {
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

/** Set a cron job to remove temporary roles from users every 24 hours */
async function setTemporaryRoleTimeouts(guild: Guild, config: Config): Promise<void> {
    const requestChannelId = config.roleRequests?.channelId;
    if (!requestChannelId) return;

    const requestQueue = await guild.channels.fetch(requestChannelId).catch(() => null);
    if (!requestQueue || !isGuildTextBasedChannel(requestQueue)) return;

    const timeouts = await db.all<Pick<TemporaryRole, "request_id" | "expires_at">>(`
        SELECT request_id, expires_at
        FROM temporary_roles
        WHERE guild_id = $guildId
    `, [{
        $guildId: guild.id
    }]);

    for (const timeout of timeouts) {
        setTemporaryRoleTimeout({
            requestId: timeout.request_id,
            expiresAt: timeout.expires_at,
            requestQueue,
            guild
        });
    }
}