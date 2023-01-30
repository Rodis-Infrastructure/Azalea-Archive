import Button from "../../handlers/interactions/buttons/Button";

import { InteractionResponseType } from "../../utils/Types";
import { ButtonInteraction } from "discord.js";

export default class SampleButton extends Button {
    constructor() {
        super({
            name: "sample-button",
            defer: InteractionResponseType.EphemeralDefer,
            skipInternalUsageCheck: false
        });
    }

    /**
     * @param {ButtonInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: ButtonInteraction): Promise<void> {
        await interaction.editReply("This is a sample **BUTTON** interaction.");
    }
}
