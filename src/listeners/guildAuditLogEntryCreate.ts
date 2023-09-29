import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry, User } from "discord.js";
import { InfractionFlag, InfractionType } from "../types/db";
import { resolveInfraction } from "../utils/moderation";
import { discordTimestamp } from "../utils";
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

        let punishment: InfractionType | undefined;
        let muteReply!: Partial<string>;
        let action!: string;

        const infractionFlag = executor.bot ? InfractionFlag.Automatic : undefined;

        switch (log.action) {
            case AuditLogEvent.MemberKick:
                punishment = InfractionType.Kick;
                action = "kicked";
                break;

            case AuditLogEvent.MemberBanAdd:
                punishment = InfractionType.Ban;
                action = "banned";
                break;

            case AuditLogEvent.MemberBanRemove:
                punishment = InfractionType.Unban;
                action = "unbanned";
                break;

            case AuditLogEvent.MemberUpdate: {
                const muteDurationDiff = changes?.find(c => c.key === "communication_disabled_until");

                if (muteDurationDiff) {
                    if (!muteDurationDiff.old && muteDurationDiff.new) {
                        punishment = InfractionType.Mute;
                        action = "muted";

                        const msDuration = Date.parse(muteDurationDiff.new as string);
                        const expiresAt = Math.floor(msDuration / 1000);
                        const duration = msDuration - Date.now();

                        muteReply = `muted until ${discordTimestamp(expiresAt, "F")} | Expires ${discordTimestamp(expiresAt, "R")}`;

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
                        punishment = InfractionType.Unmute;
                        action = "unmuted";
                    }
                }

                break;
            }
        }

        if (punishment) {
            if (punishment !== InfractionType.Mute) {
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
            await config.sendConfirmation({
                message: `${action} **${(target as User).tag}** ${muteReply || ""}`,
                authorId: executor.id,
                reason
            });
        }
    }
}