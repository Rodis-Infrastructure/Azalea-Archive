import { handleInteraction } from "../handlers/interactions";
import { Events, Interaction } from "discord.js";

import EventListener from "../handlers/listeners/eventListener";

export default class InteractionCreateEventListener extends EventListener {
    constructor() {
        super(Events.InteractionCreate);
    }

    async execute(interaction: Interaction): Promise<void> {
        if (!interaction.inGuild() || interaction.isAutocomplete()) return;
        await handleInteraction(interaction);
    }
}