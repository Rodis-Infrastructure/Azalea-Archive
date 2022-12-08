import Modal from "../../handlers/interactions/modals/Modal";
import {Client, ModalSubmitInteraction} from "discord.js";

export default class SampleModal extends Modal {
    constructor(client: Client) {
        super(client, {
            name: "sample-modal",
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