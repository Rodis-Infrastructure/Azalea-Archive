import { InteractionResponseType } from "@bot/types/interactions";
import { ActionRowBuilder, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { Component } from "@bot/handlers/interactions/interaction";

export default class RoleRequestNoteAddButton extends Component<ButtonInteraction<"cached">> {
    constructor() {
        super({
            name: "role-request-note-add",
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction<"cached">): Promise<void> {
        const noteInput = new TextInputBuilder()
            .setCustomId("note")
            .setLabel("Note")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Enter note...")
            .setMaxLength(1024)
            .setRequired(true);

        const actionRow = new ActionRowBuilder<TextInputBuilder>()
            .setComponents(noteInput);

        const modal = new ModalBuilder()
            .setCustomId("role-request-note-input")
            .setTitle("Add Note to Role Request")
            .setComponents(actionRow);

        await interaction.showModal(modal);
    }
}