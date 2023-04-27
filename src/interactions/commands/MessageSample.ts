import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";

import { ApplicationCommandType, ContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../utils/Types";

export default class MessageSampleCommand extends ContextMenuCommand {
    constructor() {
        super({
            name: "Sample",
            defer: InteractionResponseType.EphemeralDefer,
            type: ApplicationCommandType.Message,
            skipInternalUsageCheck: false
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