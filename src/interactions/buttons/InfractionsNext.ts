import { InteractionResponseType } from "../../utils/Types";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, EmbedBuilder } from "discord.js";

import Button from "../../handlers/interactions/buttons/Button";
import ClientManager from "../../Client";
import Config from "../../utils/Config";
import { mapInfractionsToFields } from "../../utils";

export default class InfractionsNextButton extends Button {
    constructor() {
        super({
            name: { startsWith: "inf-page" },
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction, _: never, config: Config): Promise<void> {
        const [direction, offenderId] = interaction.customId.split("-").slice(2);
        const cachedInfractions = ClientManager.cache.infractions.get(offenderId);
        const message = cachedInfractions?.messages.get(interaction.message.id);

        const { error } = config.emojis;

        if (!cachedInfractions) {
            await interaction.update({ components: [] });
            await interaction.followUp({
                content: `${error} Too much time has passed since \`/infraction search\` was used on this user. Please use the command again to change pages.`,
                ephemeral: true
            });
            return;
        }

        if (message?.authorId !== interaction.user.id) {
            await interaction.reply({
                content: `${error} You cannot change pages on an infraction search that you did not initiate.`,
                ephemeral: true
            });
            return;
        }

        if (direction === "next") message.page++;
        else if (direction === "back") message.page--;

        const newPageCount = message.page;
        const [maxPageCount, fields] = mapInfractionsToFields({
            infractions: cachedInfractions.data,
            filter: message.filter,
            page: newPageCount
        });

        const actionRow = new ActionRowBuilder<ButtonBuilder>(interaction.message.components[0].toJSON());
        const [backBtn, pageCountBtn, nextBtn] = actionRow.components;

        pageCountBtn.setLabel(`${newPageCount} / ${maxPageCount}`);
        backBtn.setDisabled(newPageCount === 1);
        nextBtn.setDisabled(newPageCount === maxPageCount);

        const embed = new EmbedBuilder(interaction.message.embeds[0].toJSON()).setFields(fields);
        await interaction.update({ embeds: [embed], components: [actionRow] });
    }
}