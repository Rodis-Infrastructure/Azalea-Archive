import { handleInfractionSearch } from "@bot/interactions/global_commands/infraction";
import { Component } from "@bot/handlers/interactions/interaction";
import { InteractionResponseType } from "@bot/types/interactions";
import { ButtonInteraction } from "discord.js";

import Config from "@bot/utils/config";

export default class InfractionSearchButton extends Component<ButtonInteraction<"cached">> {
    constructor() {
        super({
            // Custom ID format: inf-search-{targetId}
            name: { startsWith: "inf-search" },
            defer: InteractionResponseType.Default,
            skipEphemeralCheck: false
        });
    }

    async execute(interaction: ButtonInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        await Promise.all([
            handleInfractionSearch(interaction, config, ephemeral),
            interaction.message.edit({ components: [] })
        ]);
    }
}