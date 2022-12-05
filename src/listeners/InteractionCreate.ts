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
    }
};