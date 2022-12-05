import SelectMenu from "../../handlers/interactions/select_menus/SelectMenu";
import Bot from "../../Bot";

import {RestrictionLevel} from "../../utils/RestrictionUtils";
import {ResponseType} from "../../utils/Properties";
import {SelectMenuInteraction} from "discord.js";

export default class SampleSelectMenu extends SelectMenu {
    constructor(client: Bot) {
        super(client, {
            name: "sample-select-menu",
            restriction: RestrictionLevel.Public,
            defer: ResponseType.EphemeralDefer
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