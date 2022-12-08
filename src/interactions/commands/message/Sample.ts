import ContextMenuCommand from "../../../handlers/interactions/commands/ContextMenuCommand";

import {ApplicationCommandType, Client, ContextMenuCommandInteraction} from "discord.js";
import {InteractionResponseType} from "../../../utils/Types";

export default class SampleCommand extends ContextMenuCommand {
    constructor(client: Client) {
        super(client, {
            name: "Sample",
            defer: InteractionResponseType.EphemeralDefer,
            type: ApplicationCommandType.Message
        });
    }

    /**
     * @param {ContextMenuCommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: ContextMenuCommandInteraction): Promise<void> {
        await interaction.editReply("This is a sample **MESSAGE** command.");
    }
}