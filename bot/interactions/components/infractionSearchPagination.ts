import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, EmbedBuilder } from "discord.js";
import { InfractionFilter, MinimalInfraction } from "@database/models/infraction";
import { Component } from "@bot/handlers/interactions/interaction";
import { InteractionResponseType } from "@bot/types/interactions";
import { mapInfractionsToFields } from "@bot/utils/infractions";
import { SQLQueryBindings } from "bun:sqlite";
import { db } from "@database/utils.ts";

import Config from "@bot/utils/config";

export default class InfractionsNextButton extends Component<ButtonInteraction<"cached">> {
    constructor() {
        super({
            // Custom ID format: inf-page-{next|back}-{executorId}
            name: { startsWith: "inf-page" },
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: ButtonInteraction<"cached">, _ephemeral: never, config: Config): Promise<void> {
        const [direction, searchExecutorId] = interaction.customId.split("-").slice(2);

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const targetId = embed.data.footer?.text.replace(/\D/g, "");
        const filter = embed.data.title?.split(" ")[1] as InfractionFilter | undefined;

        if (!targetId) {
            await interaction.reply({
                content: `${config.emojis.error} Failed to fetch the target user's ID.`,
                ephemeral: true
            });
            return;
        }

        if (searchExecutorId !== interaction.user.id) {
            await interaction.reply({
                content: `${config.emojis.error} You cannot change pages on an infraction search that wasn't initiated by you.`,
                ephemeral: true
            });
            return;
        }

        const [oldActionRow] = interaction.message.components;
        const newActionRow = new ActionRowBuilder<ButtonBuilder>(oldActionRow.toJSON());

        const [backBtn, pageCountBtn, nextBtn] = newActionRow.components;
        let currentPage = parseInt(pageCountBtn.data.label!.split(" / ")[0]);

        if (direction === "next") currentPage++;
        else if (direction === "back") currentPage--;

        const stmt = db.prepare<MinimalInfraction, SQLQueryBindings>(`
            SELECT infraction_id, target_id, executor_id, action, reason, created_at, expires_at, flag
            FROM infractions
            WHERE guild_id = $guildId
              AND target_id = $targetId
            ORDER BY infraction_id DESC
            LIMIT 100;
        `);

        const infractions = stmt.all({
            $guildId: interaction.guildId,
            $targetId: targetId
        });

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