import SelectMenu from "../../handlers/interactions/select_menus/SelectMenu";

import {InteractionResponseType} from "../../utils/Types";
import {SelectMenuInteraction} from "discord.js";

export default class SampleSelectMenu extends SelectMenu {
    constructor() {
        super({
            name: "sample-select-menu",
            defer: InteractionResponseType.EphemeralDefer,
            skipInternalUsageCheck: false
        });
    }

    /**
     * @param {SelectMenuInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: SelectMenuInteraction): Promise<void> {
        await interaction.editReply("This is a sample **SELECT MENU** interaction.");
        return;
    }
}