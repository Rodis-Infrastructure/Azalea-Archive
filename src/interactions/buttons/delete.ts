import { InteractionResponseType } from "../../types/interactions";
import { ButtonInteraction } from "discord.js";
import { Component } from "../../handlers/interactions/interaction";

export default class DeleteButton extends Component<ButtonInteraction> {
    constructor() {
        super({
            name: "delete",
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction): Promise<void> {
        await interaction.message.delete();
    }
}