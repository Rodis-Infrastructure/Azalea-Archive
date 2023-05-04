import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, User } from "discord.js";
import EventListener from "../handlers/listeners/EventListener";
import { resolveInfraction } from "../utils/ModerationUtils";
import { InfractionType } from "../utils/Types";

export default class GuildAuditLogEntryCreateListener extends EventListener {
    constructor() {
        super({
            name: Events.GuildAuditLogEntryCreate,
            once: false
        });
    }

    async execute(log: GuildAuditLogsEntry, guild: Guild): Promise<void> {
        const { executor, target, reason, changes } = log;

        if (!executor || !target) {
            console.error(`Failed to resolve audit log entry [${log.action}]: Missing executor or target.`);
            return;
        }

        if (executor.bot) return;
        let infractionType: InfractionType | undefined;

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
                const timeoutChange = changes?.find(c => c.key === "communication_disabled_until");

                if (timeoutChange) {
                    if (!timeoutChange.old && timeoutChange.new) infractionType = InfractionType.Mute;
                    if (timeoutChange.old && !timeoutChange.new) infractionType = InfractionType.Unmute;
                }

                break;
            }
        }

        if (infractionType) {
            await resolveInfraction({
                moderator: executor,
                offender: target as User,
                guildId: guild.id,
                infractionType,
                reason: reason ?? undefined
            });
        }
    }
}