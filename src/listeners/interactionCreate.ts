import { Events, Interaction } from "discord.js";

import EventListener from "../handlers/listeners/eventListener";
import ClientManager from "../client";

export default class InteractionCreateEventListener extends EventListener {
    constructor() {
        super(Events.InteractionCreate);
    }

    async execute(interaction: Interaction): Promise<void> {
        if (!interaction.guild || !interaction.guildId) return;

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