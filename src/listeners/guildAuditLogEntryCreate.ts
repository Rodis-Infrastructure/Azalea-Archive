import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, User } from "discord.js";
import { resolveInfraction } from "../utils/moderation";
import { InfractionFlag, InfractionPunishment } from "../types/db";
import { formatTimestamp } from "../utils";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";

export default class GuildAuditLogEntryCreateListener extends EventListener {
    constructor() {
        super(Events.GuildAuditLogEntryCreate);
    }

    async execute(log: GuildAuditLogsEntry, guild: Guild): Promise<void> {
        const { target, reason, changes } = log;
        const { executor } = log;

        if (!executor || !target) return;
        if (executor.id === ClientManager.client.user?.id) return;

        let punishment: InfractionPunishment | undefined;
        let muteReply!: Partial<string>;
        let action!: string;

        const infractionFlag = executor.bot ? InfractionFlag.Automatic : undefined;

        switch (log.action) {
            case AuditLogEvent.MemberKick:
                punishment = InfractionPunishment.Kick;
                action = "kicked";
                break;

            case AuditLogEvent.MemberBanAdd:
                punishment = InfractionPunishment.Ban;
                action = "banned";
                break;

            case AuditLogEvent.MemberBanRemove:
                punishment = InfractionPunishment.Unban;
                action = "unbanned";
                break;

            case AuditLogEvent.MemberUpdate: {
                const muteDurationDiff = changes?.find(c => c.key === "communication_disabled_until");

                if (muteDurationDiff) {
                    if (!muteDurationDiff.old && muteDurationDiff.new) {
                        punishment = InfractionPunishment.Mute;
                        action = "muted";

                        const msDuration = Date.parse(muteDurationDiff.new as string);
                        const expiresAt = Math.floor(msDuration / 1000);
                        const duration = msDuration - Date.now();

                        muteReply = `muted until ${formatTimestamp(expiresAt, "F")} | Expires ${formatTimestamp(expiresAt, "R")}`;

                        try {
                            await resolveInfraction({
                                executor: executor,
                                targetId: (target as User).id,
                                guildId: guild.id,
                                punishment: punishment,
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

                    if (muteDurationDiff.old && !muteDurationDiff.new) {
                        punishment = InfractionPunishment.Unmute;
                        action = "unmuted";
                    }
                }

                break;
            }
        }

        if (punishment) {
            if (punishment !== InfractionPunishment.Mute) {
                await resolveInfraction({
                    executor: executor,
                    targetId: (target as User).id,
                    guildId: guild.id,
                    punishment: punishment,
                    flag: infractionFlag,
                    reason
                });
            }

            const config = ClientManager.config(guild.id)!;
            await config.sendConfirmation({
                guild,
                message: `${action} **${(target as User).tag}** ${muteReply || ""}`,
                authorId: executor.id,
                reason
            });
        }
    }
}