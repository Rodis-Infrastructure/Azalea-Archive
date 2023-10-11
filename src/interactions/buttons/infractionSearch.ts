import { Component } from "../../handlers/interactions/interaction";
import { handleInfractionSearch } from "../commands/infraction";
import { InteractionResponseType } from "../../types/interactions";
import { ButtonInteraction } from "discord.js";

import Config from "../../utils/config";

export default class InfractionSearchButton extends Component<ButtonInteraction<"cached">> {
    constructor() {
        super({
            // Custom ID format: inf-search-{targetId}
            name: { startsWith: "inf-search" },
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        await Promise.all([
            handleInfractionSearch(interaction, config, ephemeral),
            interaction.message.edit({ components: [] })
        ]);
    }
}