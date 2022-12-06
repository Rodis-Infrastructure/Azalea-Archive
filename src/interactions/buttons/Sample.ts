import Button from "../../handlers/interactions/buttons/Button";
import Bot from "../../Bot";

import {RestrictionLevel} from "../../utils/RestrictionUtils";
import {ResponseType} from "../../utils/Properties";
import {ButtonInteraction} from "discord.js";

export default class SampleButton extends Button {
    constructor(client: Bot) {
        super(client, {
            name: "sample-button",
            restriction: RestrictionLevel.Everyone,
            defer: ResponseType.EphemeralDefer
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