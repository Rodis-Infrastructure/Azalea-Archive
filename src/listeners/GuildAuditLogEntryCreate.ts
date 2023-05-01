import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, User } from "discord.js";
import EventListener from "../handlers/listeners/EventListener";
import { resolveInfraction } from "../utils/ModerationUtils";
import { LoggingEvent } from "../utils/Types";

export default class GuildAuditLogEntryCreateListener extends EventListener {
    constructor() {
        super({
            name: Events.GuildAuditLogEntryCreate,
            once: false
        });
    }

    async execute(log: GuildAuditLogsEntry, guild: Guild): Promise<void> {
        const { executor, target, reason } = log;

        if (!executor || !target) {
            console.error(`Failed to resolve audit log entry [${log.action}]: Missing executor or target.`);
            return;
        }

        if (executor.bot) return;
        let infractionType: LoggingEvent | undefined;

        switch (log.action) {
            case AuditLogEvent.MemberKick:
                infractionType = LoggingEvent.MemberKick;
                break;

            case AuditLogEvent.MemberBanAdd:
                infractionType = LoggingEvent.MemberBan;
                break;

            case AuditLogEvent.MemberBanRemove:
                infractionType = LoggingEvent.MemberUnban;
                break;
        }

        if (infractionType) {
            await resolveInfraction({
                moderator: executor,
                offender: target as User,
                guildId: guild.id,
                infractionType,
                reason
            });
        }
    }
}