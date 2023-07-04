import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, User } from "discord.js";
import { resolveInfraction } from "../utils/moderationUtils";
import { InfractionType } from "../utils/utils.types";
import { InfractionFlag } from "../db/db.types";
import { formatTimestamp } from "../utils";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";

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
        let muteReply!: Partial<string>;
        const infractionFlag = executor.bot ? InfractionFlag.Automatic : undefined;

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

                        const msDuration = Date.parse(muteDurationDiff.new as string);
                        const expiresAt = Math.floor(msDuration / 1000);
                        const duration = msDuration - Date.now();

                        muteReply = `muted until ${formatTimestamp(expiresAt, "F")} | Expires ${formatTimestamp(expiresAt, "R")}`;

                        try {
                            await resolveInfraction({
                                moderator: executor,
                                offender: target as User,
                                guildId: guild.id,
                                infractionType,
                                flag: infractionFlag,
                                reason,
                                /* Prevent mute duration from being less than 1 minute */
                                duration: duration < 60000
                                    ? 60000
                                    : duration
                            });
                        } catch (err) {
                            console.error(err);
                        }
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
                    flag: infractionFlag,
                    reason
                });
            }

            const config = ClientManager.config(guild.id)!;
            const action = infractionType.split(" ")[1].toLowerCase();

            await config.sendConfirmation({
                guild,
                message: `${action} **${(target as User).tag}** ${muteReply || ""}`,
                authorId: executor.id,
                reason
            });
        }
    }
}