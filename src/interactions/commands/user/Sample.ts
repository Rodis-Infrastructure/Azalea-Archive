import ContextMenuCommand from "../../../handlers/interactions/commands/ContextMenuCommand";
import Bot from "../../../Bot";

import {ApplicationCommandType, ContextMenuCommandInteraction} from "discord.js";
//import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

export default class SampleCommand extends ContextMenuCommand {
    constructor(client: Bot) {
        super(client, {
            name: "Sample",
            //            restriction: RestrictionLevel.Public,
            defer: ResponseType.EphemeralDefer,
            type: ApplicationCommandType.User
        });
    }

    /**
    * @param {ContextMenuCommandInteraction} interaction
    * @returns {Promise<void>}
    */
    async execute(interaction: ContextMenuCommandInteraction): Promise<void> {
        await interaction.editReply("This is a sample **USER** command.");
        return;
    }
}