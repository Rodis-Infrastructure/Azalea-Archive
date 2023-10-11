import { Events, GuildMember } from "discord.js";
import { PunishmentType } from "../types/db";
import { currentTimestamp } from "../utils";
import { runQuery } from "../db";

import EventListener from "../handlers/listeners/eventListener";

export default class InteractionCreateEventListener extends EventListener {
    constructor() {
        super(Events.GuildMemberUpdate);
    }

    async execute(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
        // Update the mute expiration timestamp if the member was unmuted early
        if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
            await runQuery(`
                UPDATE infractions
                SET expires_at = ${currentTimestamp()}
                WHERE guild_id = ${newMember.guild.id}
                  AND target_id = ${newMember.id}
                  AND action = ${PunishmentType.Mute}
                  AND expires_at > ${currentTimestamp()};
            `);
        }
    }
}