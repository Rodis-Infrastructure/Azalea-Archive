import { InteractionResponseType } from "@bot/types/interactions";
import { ButtonInteraction } from "discord.js";
import { Component } from "@bot/handlers/interactions/interaction";

export default class DeleteButton extends Component<ButtonInteraction<"cached">> {
    constructor() {
        super({
            name: "delete",
            defer: InteractionResponseType.Default,
            skipEphemeralCheck: false
        });
    }

    async execute(interaction: ButtonInteraction<"cached">): Promise<void> {
        await interaction.message.delete();
    }
}