import { InteractionResponseType } from "../interaction.types";
import { SelectMenuInteraction } from "discord.js";

import SelectMenu from "../../handlers/interactions/select_menus/selectMenu";

export default class SampleSelectMenu extends SelectMenu {
    constructor() {
        super({
            name: "sample-select-menu",
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: SelectMenuInteraction): Promise<void> {
        await interaction.editReply("This is a sample **SELECT MENU** interaction.");
    }
}