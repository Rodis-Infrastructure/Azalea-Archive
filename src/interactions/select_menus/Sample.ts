import SelectMenu from "../../handlers/interactions/select_menus/SelectMenu";

import {InteractionResponseType} from "../../utils/Types";
import {Client, SelectMenuInteraction} from "discord.js";

export default class SampleSelectMenu extends SelectMenu {
    constructor(client: Client) {
        super(client, {
            name: "sample-select-menu",
            defer: InteractionResponseType.EphemeralDefer
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