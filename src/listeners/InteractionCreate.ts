import EventListener from "../handlers/listeners/EventListener";
import Bot from "../Bot";

import {Interaction, InteractionType} from "discord.js";

module.exports = class InteractionCreateEventListener extends EventListener {
    constructor(client: Bot) {
        super(client, {name: "interactionCreate"});
    }

    public async execute(interaction: Interaction) {
        if (
            interaction.isChatInputCommand() ||
            interaction.isMessageContextMenuCommand() ||
            interaction.isUserContextMenuCommand()
        ) {
            await this.client.commands.handle(interaction);
        }

        if (interaction.isButton()) await this.client.buttons.handle(interaction);
        if (interaction.isModalSubmit()) await this.client.modals.handle(interaction);
        if (interaction.isStringSelectMenu()) await this.client.select_menus.handle(interaction);
    }
};