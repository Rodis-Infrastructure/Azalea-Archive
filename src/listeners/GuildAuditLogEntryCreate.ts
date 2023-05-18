import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, GuildTextBasedChannel, User } from "discord.js";
import { resolveInfraction } from "../utils/ModerationUtils";
import { InfractionType } from "../utils/Types";

import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";

export default class GuildAuditLogEntryCreateListener extends EventListener {
    constructor() {
        super(Events.GuildAuditLogEntryCreate);
    }

    async execute(log: GuildAuditLogsEntry, guild: Guild): Promise<void> {
        const { target, reason, changes } = log;
        let { executor } = log;

        if (!executor || !target) {
            console.error(`Failed to resolve audit log entry [${log.action}]: Missing executor or target.`);
            return;
        }

        if (executor.id === ClientManager.client.user?.id) return;
        if (executor.partial) executor = await executor.fetch();

        let infractionType: InfractionType | undefined;
        const channelResponse = [`**${executor.tag}** has successfully`];

        switch (log.action) {
            case AuditLogEvent.MemberKick:
                infractionType = InfractionType.Kick;
                break;

            case AuditLogEvent.MemberBanAdd:
                infractionType = InfractionType.Ban;
                break;

            case AuditLogEvent.MemberBanRemove:
                infractionType = InfractionType.Unban;
                break;

            case AuditLogEvent.MemberUpdate: {
                const muteDurationDiff = changes?.find(c => c.key === "communication_disabled_until");

                if (muteDurationDiff) {
                    if (!muteDurationDiff.old && muteDurationDiff.new) {
                        infractionType = InfractionType.Mute;

                        const parsedMuteExpiration = Date.parse(muteDurationDiff.new as string);
                        const muteExpirationTimestamp = Math.floor(parsedMuteExpiration / 1000);

                        channelResponse.push(`until <t:${muteExpirationTimestamp}:F> | Expires <t:${muteExpirationTimestamp}:R>`);

                        const muteDurationTimestamp = parsedMuteExpiration - Date.now();
                        await resolveInfraction({
                            moderator: executor,
                            offender: target as User,
                            guildId: guild.id,
                            infractionType,
                            reason,
                            /* Prevent mute duration from being less than 1 minute */
                            duration: muteDurationTimestamp < 60000
                                ? 60000
                                : muteDurationTimestamp
                        });
                    }

                    if (muteDurationDiff.old && !muteDurationDiff.new) infractionType = InfractionType.Unmute;
                }

                break;
            }
        }

        if (infractionType) {
            if (infractionType !== InfractionType.Mute) {
                await resolveInfraction({
                    moderator: executor,
                    offender: target as User,
                    guildId: guild.id,
                    infractionType,
                    reason
                });
            }

            const config = ClientManager.config(guild.id)!;
            const channelId = config.channels.staffCommands;
            if (!channelId) return;

            const channel = await guild.channels.fetch(channelId) as GuildTextBasedChannel;
            if (!channel) return;

            channelResponse.splice(1, 0, `${infractionType.split(" ")[1].toLowerCase()} **${(target as User).tag}**`);
            if (infractionType !== InfractionType.Unmute && reason) channelResponse.push(`(\`${reason}\`)`);

            await channel.send(`${config.emojis.success} ${channelResponse.join(" ")}`);
        }
    }
}