import { Events, GuildMember } from "discord.js";
import { currentTimestamp } from "../utils";
import { runQuery } from "../db";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";

export default class InteractionCreateEventListener extends EventListener {
    constructor() {
        super(Events.GuildMemberUpdate);
    }

    async execute(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
        if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
            const infractionId = ClientManager.cache.activeMutes.get(newMember.id);

            if (infractionId) {
                ClientManager.cache.activeMutes.delete(newMember.id);
                await runQuery(`
					UPDATE infractions
					SET expires_at = ${currentTimestamp()}
					WHERE guild_id = ${newMember.guild.id}
					  AND infraction_id = ${infractionId};
                `);
            }
        }
    }
}