import { ApplicationCommandType, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../types/interactions";
import { handleQuickMute } from "../../utils/moderation";
import { Command } from "../../handlers/interactions/interaction";

import Config from "../../utils/config";

export default class QuickMute30Command extends Command {
    constructor() {
        super({
            name: "Quick mute (30m)",
            defer: InteractionResponseType.Default,
            type: ApplicationCommandType.Message,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction, _: never, config: Config): Promise<void> {
        await handleQuickMute("30m", interaction, config);
    }
}