import { ApplicationCommandType, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { QuickMuteDuration } from "@bot/types/moderation";
import { handleQuickMute } from "@bot/utils/moderation";

import Config from "@bot/utils/config";

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
        const { response } = await handleQuickMute({
            message: interaction.targetMessage,
            duration: QuickMuteDuration.Long,
            executorId: interaction.user.id,
            config
        });

        await interaction.reply({
            content: response,
            ephemeral: true
        });
    }
}