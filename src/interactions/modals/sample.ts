import { Component } from "../../handlers/interactions/interaction";
import { InteractionResponseType } from "../../types/interactions";
import { ModalSubmitInteraction } from "discord.js";

export default class SampleModal extends Component<ModalSubmitInteraction> {
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