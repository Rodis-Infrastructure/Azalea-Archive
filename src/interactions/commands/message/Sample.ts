import MessageCommand from "../../../handlers/interactions/commands/MessageCommand";
import Bot from "../../../Bot";

import {MessageContextMenuCommandInteraction, ApplicationCommandType} from "discord.js";
//import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

export default class SampleCommand extends MessageCommand {
    constructor(client: Bot) {
        super(client, {
            name: "Sample",
            //            restriction: RestrictionLevel.Public,
            defer: ResponseType.EphemeralDefer,
            type: ApplicationCommandType.Message
        });
    }

    /**
     * @param {MessageContextMenuCommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        await interaction.editReply("This is a sample command.");
        return;
    }
}