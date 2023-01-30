import Modal from "../../handlers/interactions/modals/Modal";
import { ModalSubmitInteraction } from "discord.js";

export default class SampleModal extends Modal {
    constructor() {
        super({
            name: "sample-modal",
            ephemeral: true,
            skipInternalUsageCheck: false
        });
    }

    /**
     * @param  {ModalSubmitInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: ModalSubmitInteraction): Promise<void> {
        await interaction.editReply("This is a sample **MODAL**");
    }
}
