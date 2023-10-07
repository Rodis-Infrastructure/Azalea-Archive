import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, time, User } from "discord.js";
import { InfractionFlag, PunishmentType } from "../types/db";
import { resolveInfraction } from "../utils/moderation";
import { client } from "../client";

import EventListener from "../handlers/listeners/eventListener";
import Config from "../utils/config";

export default class GuildAuditLogEntryCreateListener extends EventListener {
    constructor() {
        super(Events.GuildAuditLogEntryCreate);
    }

    async execute(log: GuildAuditLogsEntry, guild: Guild): Promise<void> {
        const { target, reason, changes } = log;
        const { executor } = log;

        if (!executor || !target) return;
        if (executor.id === client.user?.id) return;

        let punishment: PunishmentType | undefined;
        let muteReply!: Partial<string>;
        let action!: string;

        const infractionFlag = executor.bot ? InfractionFlag.Automatic : undefined;

        switch (log.action) {
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
                const muteDurationDiff = changes?.find(c => c.key === "communication_disabled_until");

                if (muteDurationDiff) {
                    if (!muteDurationDiff.old && muteDurationDiff.new) {
                        punishment = PunishmentType.Mute;
                        action = "muted";

                        const msDuration = Date.parse(muteDurationDiff.new as string);
                        const expiresAt = Math.floor(msDuration / 1000);
                        const duration = msDuration - Date.now();

                        muteReply = `muted until ${time(expiresAt, "F")} | Expires ${time(expiresAt, "R")}`;

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
                    executor: executor,
                    targetId: (target as User).id,
                    guildId: guild.id,
                    punishment: punishment,
                    flag: infractionFlag,
                    reason
                });
            }

            const config = Config.get(guild.id)!;
            await config.sendActionConfirmation({
                message: `${action} **${(target as User).tag}** ${muteReply || ""}`,
                authorId: executor.id,
                reason
            });
        }
    }
}