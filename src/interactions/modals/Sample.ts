import Modal from "../../handlers/interactions/modals/Modal";
import Bot from "../../Bot";

import {RestrictionLevel} from "../../utils/RestrictionUtils";
import {ModalSubmitInteraction} from "discord.js";


export default class SampleModal extends Modal {
    constructor(client: Bot) {
        super(client, {
            name: "sample-modal",
            restriction: RestrictionLevel.Public,
            ephemeral: true
        });
    }

    /**
    * @param  {ModalSubmitInteraction} interaction
    * @returns {Promise<void>}
    */
    async execute(interaction: ModalSubmitInteraction): Promise<void> {
        await interaction.editReply("This is a sample **MODAL**")
    }
}