import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, GuildTextBasedChannel, User } from "discord.js";
import EventListener from "../handlers/listeners/EventListener";
import { resolveInfraction } from "../utils/ModerationUtils";
import { InfractionType } from "../utils/Types";
import ClientManager from "../Client";

export default class GuildAuditLogEntryCreateListener extends EventListener {
    constructor() {
        super({
            name: Events.GuildAuditLogEntryCreate,
            once: false
        });
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
        let channelResponse = `**${executor.tag}** has successfully `;

        switch (log.action) {
            case AuditLogEvent.MemberKick:
                infractionType = InfractionType.Kick;
                channelResponse += `kicked **${(target as User).tag}**${reason ? ` (\`${reason}\`)` : ""}`;
                break;

            case AuditLogEvent.MemberBanAdd:
                infractionType = InfractionType.Ban;
                channelResponse += `banned **${(target as User).tag}**${reason ? ` (\`${reason}\`)` : ""}`;
                break;

            case AuditLogEvent.MemberBanRemove:
                infractionType = InfractionType.Unban;
                channelResponse += `unbanned **${(target as User).tag}**${reason ? ` (\`${reason}\`)` : ""}`;
                break;

            case AuditLogEvent.MemberUpdate: {
                const timeoutChange = changes?.find(c => c.key === "communication_disabled_until");

                if (timeoutChange) {
                    if (!timeoutChange.old && timeoutChange.new) {
                        infractionType = InfractionType.Mute;

                        const duration = Math.round(Date.parse(timeoutChange.new as string) / 1000);
                        channelResponse += `muted **${(target as User).tag}** until <t:${duration}:F> | Expires <t:${duration}:R>${reason ? ` (\`${reason}\`)` : ""}`;
                    }
                    if (timeoutChange.old && !timeoutChange.new) {
                        infractionType = InfractionType.Unmute;
                        channelResponse += `unmuted **${(target as User).tag}**`;
                    }
                }

                break;
            }
        }

        if (infractionType) {
            await Promise.all([
                resolveInfraction({
                    moderator: executor,
                    offender: target as User,
                    guildId: guild.id,
                    infractionType,
                    reason: reason ?? undefined
                })
            ]);

            const config = ClientManager.config(guild.id)!;
            const channelId = config.channels.staffCommands;
            if (!channelId) return;

            const channel = await guild.channels.fetch(channelId) as GuildTextBasedChannel;
            if (!channel) return;

            await channel.send(`${config.emojis.success} ${channelResponse}`);
        }
    }
}