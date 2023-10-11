import { Component } from "../../handlers/interactions/interaction";
import { InteractionResponseType } from "../../types/interactions";
import { StringSelectMenuInteraction } from "discord.js";

export default class SampleSelectMenu extends Component<StringSelectMenuInteraction<"cached">> {
    constructor() {
        super({
            name: "sample-select-menu",
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: StringSelectMenuInteraction<"cached">): Promise<void> {
        await interaction.editReply("This is a sample **SELECT MENU** interaction.");
    }
}