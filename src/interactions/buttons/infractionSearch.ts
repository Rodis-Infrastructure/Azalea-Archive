import { handleUserInfractionSearch } from "../commands/infraction";
import { InteractionResponseType } from "../../types/interactions";
import { ButtonInteraction } from "discord.js";

import Button from "../../handlers/interactions/buttons/button";
import Config from "../../utils/config";

export default class InfractionSearchButton extends Button {
    constructor() {
        super({
            name: { startsWith: "inf-search" },
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction, ephemeral: boolean, config: Config): Promise<void> {
        await Promise.all([
            handleUserInfractionSearch(interaction, config, ephemeral),
            interaction.message.edit({ components: [] })
        ]);
    }
}