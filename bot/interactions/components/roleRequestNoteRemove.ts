import { InteractionResponseType } from "@bot/types/interactions";
import {
    ActionRow,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonComponent,
    ButtonInteraction,
    ButtonStyle,
    EmbedBuilder
} from "discord.js";
import { Component } from "@bot/handlers/interactions/interaction";

export default class RoleRequestNoteRemoveButton extends Component<ButtonInteraction<"cached">> {
    constructor() {
        super({
            name: "role-request-note-remove",
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction<"cached">): Promise<void> {
        const addNoteBtn = new ButtonBuilder()
            .setCustomId("role-request-note-add")
            .setLabel("Add Note")
            .setStyle(ButtonStyle.Primary);

        // Use pop to retrieve the last action row as it'll always be the one we want to modify
        const currentActionRow = interaction.message.components.pop() as ActionRow<ButtonComponent>;
        const newActionRow = ActionRowBuilder.from<ButtonBuilder>(currentActionRow);

        // The first button will always be "Add Note" or "Remove Note"
        newActionRow.components[0] = addNoteBtn;

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .spliceFields(-1, 1);

        await interaction.update({
            embeds: [embed],
            components: [
                ...interaction.message.components,
                newActionRow
            ]
        });
    }
}