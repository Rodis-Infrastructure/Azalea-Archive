import { Component } from "../../handlers/interactions/interaction";
import { handleUserInfractionSearch } from "../commands/infraction";
import { InteractionResponseType } from "../../types/interactions";
import { ButtonInteraction } from "discord.js";

import Config from "../../utils/config";

export default class InfractionSearchButton extends Component<ButtonInteraction> {
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