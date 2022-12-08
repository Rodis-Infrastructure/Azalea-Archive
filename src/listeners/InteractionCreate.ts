import EventListener from "../handlers/listeners/EventListener";

import {selectMenuManager, commandManager, buttonManager, modalManager} from "../Client";
import {Client, Interaction, InteractionType} from "discord.js";

export default class InteractionCreateEventListener extends EventListener {
    constructor(client: Client) {
        super(client, {name: "interactionCreate"});
    }

    async execute(interaction: Interaction): Promise<void> {
        if (
            interaction.isChatInputCommand() ||
            interaction.isMessageContextMenuCommand() ||
            interaction.isUserContextMenuCommand()
        ) await commandManager.handle(interaction);

        if (interaction.isButton()) await buttonManager.handle(interaction);
        if (interaction.isModalSubmit()) await modalManager.handle(interaction);
        if (interaction.isStringSelectMenu()) await selectMenuManager.handle(interaction);
    }
};