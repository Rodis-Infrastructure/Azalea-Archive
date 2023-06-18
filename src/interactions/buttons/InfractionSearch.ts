import { handleUserInfractionSearch } from "../commands/Infraction";
import { InteractionResponseType } from "../../utils/Types";
import { ButtonInteraction } from "discord.js";

import Button from "../../handlers/interactions/buttons/Button";
import Config from "../../utils/Config";

export default class InfractionSearchButton extends Button {
    constructor() {
        super({
            name: { startsWith: "inf-search" },
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction, config: Config): Promise<void> {
        await Promise.all([
            handleUserInfractionSearch(interaction, config),
            interaction.message.edit({ components: [] })
        ]);
    }
}