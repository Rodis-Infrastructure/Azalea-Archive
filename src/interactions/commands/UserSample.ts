import ContextMenuCommand from "../../handlers/interactions/commands/ContextMenuCommand";

import { ApplicationCommandType, ContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../utils/Types";

export default class UserSampleCommand extends ContextMenuCommand {
    constructor() {
        super({
            name: "Sample",
            defer: InteractionResponseType.EphemeralDefer,
            type: ApplicationCommandType.User,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ContextMenuCommandInteraction): Promise<void> {
        await interaction.editReply("This is a sample **USER** command.");
    }
}