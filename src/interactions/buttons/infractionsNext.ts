import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, EmbedBuilder } from "discord.js";
import { Component } from "../../handlers/interactions/interaction";
import { InteractionResponseType } from "../../types/interactions";
import { mapInfractionsToFields } from "../../utils/infractions";
import { InfractionFilter } from "../../types/utils";
import { MinimalInfraction } from "../../types/db";
import { allQuery } from "../../db";

import Config from "../../utils/config";

export default class InfractionsNextButton extends Component<ButtonInteraction> {
    constructor() {
        super({
            // Custom ID format: inf-page-{next|back}-{targetId}
            name: { startsWith: "inf-page" },
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction, _: never, config: Config): Promise<void> {
        const [direction, targetId] = interaction.customId.split("-").slice(2);
        const searchExecutorId = interaction.message.interaction?.user.id;

        if (searchExecutorId !== interaction.user.id) {
            await interaction.reply({
                content: `${config.emojis.error} You cannot change pages on an infraction search that wasn't initiated by you.`,
                ephemeral: true
            });
            return;
        }

        const oldActionRow = interaction.message.components[0];
        const newActionRow = new ActionRowBuilder<ButtonBuilder>(oldActionRow.toJSON());

        const [backBtn, pageCountBtn, nextBtn] = newActionRow.components;
        let currentPage = parseInt(pageCountBtn.data.label!.split(" / ")[0]);

        if (direction === "next") currentPage++;
        else if (direction === "back") currentPage--;

        const infractions = await allQuery<MinimalInfraction>(`
            SELECT infraction_id,
                   target_id,
                   executor_id,
                   action,
                   reason,
                   created_at,
                   expires_at,
                   flag
            FROM infractions
            WHERE guild_id = ${interaction.guildId}
              AND target_id = ${targetId}
            ORDER BY created_at DESC
            LIMIT 100;
        `);

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const filter = embed.data.title?.split(" ")[1] as InfractionFilter | undefined;

        const [pageCount, fields] = mapInfractionsToFields({
            infractions,
            filter: filter || null,
            page: currentPage
        });

        pageCountBtn.setLabel(`${currentPage} / ${pageCount}`);
        backBtn.setDisabled(currentPage === 1);
        nextBtn.setDisabled(currentPage === pageCount);
        embed.setFields(fields);

        await interaction.update({ embeds: [embed], components: [newActionRow] });
    }
}