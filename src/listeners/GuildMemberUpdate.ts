import { Events, GuildMember } from "discord.js";

import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";
import { runQuery } from "../db";

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
					SET expiresAt = ${Math.ceil(Date.now() / 1000)}
					WHERE guildId = ${newMember.guild.id}
					  AND id = ${infractionId};
                `);
            }
        }
    }
}