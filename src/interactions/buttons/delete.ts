import { InteractionResponseType } from "../../types/interactions";
import { ButtonInteraction } from "discord.js";

import Button from "../../handlers/interactions/buttons/button";

export default class DeleteButton extends Button {
    constructor() {
        super({
            name: "delete",
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction): Promise<void> {
        await interaction.message.delete();
    }
}