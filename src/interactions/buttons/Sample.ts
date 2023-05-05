import { InteractionResponseType } from "../../utils/Types";
import { ButtonInteraction } from "discord.js";

import Button from "../../handlers/interactions/buttons/Button";

export default class SampleButton extends Button {
    constructor() {
        super({
            name: "sample-button",
            defer: InteractionResponseType.EphemeralDefer,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction): Promise<void> {
        await interaction.editReply("This is a sample **BUTTON** interaction.");
    }
}