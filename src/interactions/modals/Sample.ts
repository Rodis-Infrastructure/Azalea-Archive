import Modal from "../../handlers/interactions/modals/Modal";
import { ModalSubmitInteraction } from "discord.js";
import { InteractionResponseType } from "../../utils/Types";

export default class SampleModal extends Modal {
    constructor() {
        super({
            name: "sample-modal",
            ephemeral: true,
            skipInternalUsageCheck: false,
            defer: InteractionResponseType.Defer
        });
    }

    async execute(interaction: ModalSubmitInteraction): Promise<void> {
        await interaction.editReply("This is a sample **MODAL**");
    }
}