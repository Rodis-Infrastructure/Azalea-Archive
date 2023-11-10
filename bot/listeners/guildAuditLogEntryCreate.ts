import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, User } from "discord.js";
import { InfractionFlag, PunishmentType } from "@database/models/infraction";
import { resolveInfraction } from "@bot/utils/moderation";
import { formatMuteExpirationResponse } from "@bot/utils";
import { client } from "@bot/client";

import EventListener from "@bot/handlers/listeners/eventListener";
import Config from "@bot/utils/config";

export default class GuildAuditLogEntryCreateListener extends EventListener {
    constructor() {
        super(Events.GuildAuditLogEntryCreate);
    }

    async execute(auditLog: GuildAuditLogsEntry, guild: Guild): Promise<void> {
        const { target, reason, changes, executor } = auditLog;

        if (!executor || !target || executor.id === client.user?.id) return;

        let response = "";
        let punishment: PunishmentType | undefined;
        let action!: string;

        const infractionFlag = executor.bot ? InfractionFlag.Automatic : undefined;

        switch (auditLog.action) {
            case AuditLogEvent.MemberKick:
                punishment = PunishmentType.Kick;
                action = "kicked";
                break;

            case AuditLogEvent.MemberBanAdd:
                punishment = PunishmentType.Ban;
                action = "banned";
                break;

            case AuditLogEvent.MemberBanRemove:
                punishment = PunishmentType.Unban;
                action = "unbanned";
                break;

            case AuditLogEvent.MemberUpdate: {
                const muteDurationDiff = changes.find(change => change.key === "communication_disabled_until");

                if (muteDurationDiff) {
                    // User has been muted
                    if (!muteDurationDiff.old && muteDurationDiff.new) {
                        punishment = PunishmentType.Mute;
                        action = "muted";

                        const msDuration = Date.parse(muteDurationDiff.new as string);
                        const expiresAt = Math.floor(msDuration / 1000);
                        const duration = msDuration - Date.now();

                        response = ` until ${formatMuteExpirationResponse(expiresAt)}`;

                        try {
                            await resolveInfraction({
                                executorId: executor.id,
                                targetId: (target as User).id,
                                guildId: guild.id,
                                punishment,
                                flag: infractionFlag,
                                reason,
                                // Prevent mute duration from being under 1 minute
                                duration: duration < 60_000
                                    ? 60_000
                                    : duration
                            });
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    // User has been unmuted
                    if (muteDurationDiff.old && !muteDurationDiff.new) {
                        punishment = PunishmentType.Unmute;
                        action = "unmuted";
                    }
                }

                break;
            }
        }

        if (punishment) {
            if (punishment !== PunishmentType.Mute) {
                await resolveInfraction({
                    executorId: executor.id,
                    targetId: (target as User).id,
                    guildId: guild.id,
                    punishment: punishment,
                    flag: infractionFlag,
                    reason
                });
            }

            const config = Config.get(guild.id)!;
            const confirmation = config.formatConfirmation(`${action} ${target}${response}`, {
                executorId: executor.id,
                success: true
            });

            await config.sendNotification(confirmation);
        }
    }
}