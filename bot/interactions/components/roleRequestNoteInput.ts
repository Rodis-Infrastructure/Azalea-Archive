import {
    ActionRow,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonComponent,
    ButtonStyle,
    EmbedBuilder,
    ModalSubmitInteraction
} from "discord.js";

import { Component } from "@bot/handlers/interactions/interaction";
import { InteractionResponseType } from "@bot/types/interactions";

import Config from "@bot/utils/config";

export default class RoleRequestNoteInputButton extends Component<ModalSubmitInteraction<"cached">> {
    constructor() {
        super({
            name: "role-request-note-input",
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ModalSubmitInteraction<"cached">, _ephemeral: never, config: Config): Promise<void> {
        const [inputField] = interaction.components[0].components;
        const note = inputField.value;

        if (!interaction.message) {
            await interaction.reply({
                content: `${config.emojis.error} Failed to retrieve the request.`,
                ephemeral: true
            });
            return;
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .addFields({
                name: `Note by ${interaction.user.tag}`,
                value: note
            });

        const removeNoteBtn = new ButtonBuilder()
            .setCustomId("role-request-note-remove")
            .setLabel("Remove Note")
            .setStyle(ButtonStyle.Danger);

        // Use pop to retrieve the last action row as it'll always be the one we want to modify
        const currentActionRow = interaction.message.components.pop() as ActionRow<ButtonComponent>;
        const newActionRow = ActionRowBuilder.from<ButtonBuilder>(currentActionRow);

        // The first button will always be "Add Note" or "Remove Note"
        newActionRow.components[0] = removeNoteBtn;

        await interaction.message.edit({
            embeds: [embed],
            components: [
                ...interaction.message.components,
                newActionRow
            ]
        });

        await interaction.reply({
            content: `${config.emojis.success} Successfully added note to the request.`,
            ephemeral: true
        });
    }
}