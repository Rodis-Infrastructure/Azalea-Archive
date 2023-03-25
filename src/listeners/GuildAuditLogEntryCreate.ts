import { Events, GuildAuditLogsEntry, AuditLogEvent, User, Guild } from "discord.js";
import EventListener from "../handlers/listeners/EventListener";
import { resolveMemberKick } from "../utils/ModerationUtils";

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

        switch (log.action) {
            case AuditLogEvent.MemberKick: {
                await resolveMemberKick({
                    moderator: executor,
                    offender: target as User,
                    guildId: guild.id,
                    reason
                });
            }
        }
    }
}
