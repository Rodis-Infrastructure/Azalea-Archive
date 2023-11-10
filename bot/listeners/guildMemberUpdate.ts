import { PunishmentType } from "@database/models/infraction";
import { Events, GuildMember } from "discord.js";
import { currentTimestamp } from "@bot/utils";
import { db } from "@database/utils.ts";

import EventListener from "@bot/handlers/listeners/eventListener";

export default class InteractionCreateEventListener extends EventListener {
    constructor() {
        super(Events.GuildMemberUpdate);
    }

    async execute(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
        // Update the mute expiration timestamp if the member was unmuted early
        if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
            await db.run(`
                UPDATE infractions
                SET expires_at = $expiresAt
                WHERE guild_id = $guildId
                  AND target_id = $targetId
                  AND action = $action
                  AND expires_at > $expiresAt
            `, [{
                $expiresAt: currentTimestamp(),
                $guildId: newMember.guild.id,
                $targetId: newMember.id,
                $action: PunishmentType.Mute
            }]);
        }
    }
}