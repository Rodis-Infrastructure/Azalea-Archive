import Button from "../../handlers/interactions/buttons/Button";

import {InteractionResponseType} from "../../utils/Types";
import {ButtonInteraction, Client} from "discord.js";

export default class SampleButton extends Button {
    constructor(client: Client) {
        super(client, {
            name: "sample-button",
            defer: InteractionResponseType.EphemeralDefer
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