import { ApplicationCommandType, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { handleQuickMute } from "../../utils/moderation";

import Config from "../../utils/config";

export default class QuickMute60Command extends Command {
    constructor() {
        super({
            name: "Quick mute (60m)",
            defer: InteractionResponseType.Default,
            type: ApplicationCommandType.Message,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction<"cached">, _ephemeral: never, config: Config): Promise<void> {
        await handleQuickMute("1h", interaction, config);
    }
}