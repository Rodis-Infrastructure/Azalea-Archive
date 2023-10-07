import { PunishmentType } from "../types/db";
import { Events, GuildMember } from "discord.js";
import { currentTimestamp } from "../utils";
import { runQuery } from "../db";

import EventListener from "../handlers/listeners/eventListener";

export default class InteractionCreateEventListener extends EventListener {
    constructor() {
        super(Events.GuildMemberUpdate);
    }

    async execute(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
        if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
            const now = currentTimestamp();

            // Update the mute expiration timestamp to now
            await runQuery(`
                UPDATE infractions
                SET expires_at = ${now}
                WHERE guild_id = ${newMember.guild.id}
                  AND target_id = ${newMember.id}
                  AND action = ${PunishmentType.Mute}
                  AND expires_at > ${now};
            `);
        }
    }
}