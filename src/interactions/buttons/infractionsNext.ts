import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, EmbedBuilder } from "discord.js";
import { InteractionResponseType } from "../../types/interactions";

import Button from "../../handlers/interactions/buttons/button";
import Config from "../../utils/config";
import { allQuery } from "../../db";
import { mapInfractionsToFields } from "../../utils";
import { MinimalInfraction } from "../../types/db";
import { InfractionFilter } from "../../types/utils";

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
        const { error } = config.emojis;

        if (interaction.message.interaction?.user.id !== interaction.user.id) {
            await interaction.reply({
                content: `${error} You cannot change pages on an infraction search that you did not initiate.`,
                ephemeral: true
            });
            return;
        }

        const actionRow = new ActionRowBuilder<ButtonBuilder>(interaction.message.components[0].toJSON());
        const [backBtn, pageCountBtn, nextBtn] = actionRow.components;
        let pageCount = parseInt(pageCountBtn.data.label!.split(" / ")[0]);

        if (direction === "next") pageCount++;
        else if (direction === "back") pageCount--;

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
              AND target_id = ${offenderId}
            ORDER BY created_at DESC
            LIMIT 100;
        `);

        const embedTitle = interaction.message.embeds[0].title;
        const filter = (embedTitle?.split(" ")[1] as InfractionFilter | undefined) || null;
        const [maxPageCount, fields] = mapInfractionsToFields({
            infractions,
            filter,
            page: pageCount
        });

        pageCountBtn.setLabel(`${pageCount} / ${maxPageCount}`);
        backBtn.setDisabled(pageCount === 1);
        nextBtn.setDisabled(pageCount === maxPageCount);

        const embed = new EmbedBuilder(interaction.message.embeds[0].toJSON()).setFields(fields);
        await interaction.update({ embeds: [embed], components: [actionRow] });
    }
}