import { InteractionResponseType } from "../interaction.types";
import { ModalSubmitInteraction } from "discord.js";

import Modal from "../../handlers/interactions/modals/modal";

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