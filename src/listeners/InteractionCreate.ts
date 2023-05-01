import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";

import { Events, Interaction } from "discord.js";

export default class InteractionCreateEventListener extends EventListener {
    constructor() {
        super({
            name: Events.InteractionCreate,
            once: false
        });
    }

    async execute(interaction: Interaction): Promise<void> {
        if (
            interaction.isChatInputCommand() ||
            interaction.isMessageContextMenuCommand() ||
            interaction.isUserContextMenuCommand()
        ) await ClientManager.commands.handle(interaction);

        if (interaction.isButton()) await ClientManager.buttons.handle(interaction);
        if (interaction.isModalSubmit()) await ClientManager.modals.handle(interaction);
        if (interaction.isStringSelectMenu()) await ClientManager.selections.handle(interaction);
    }
}