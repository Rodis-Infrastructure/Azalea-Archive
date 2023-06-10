import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder
} from "discord.js";

import { InfractionSubcommand, InteractionResponseType } from "../../utils/Types";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import { fetchInfraction } from "../../db";
import { getInfractionFlagName, getInfractionName, msToString } from "../../utils";

export default class KickCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "infraction",
            description: "All infraction-related commands",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: InfractionSubcommand.Info,
                    description: "Get information about an infraction",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{
                        name: "id",
                        description: "The ID of the infraction",
                        type: ApplicationCommandOptionType.Number,
                        required: true
                    }]
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === InfractionSubcommand.Info) {
            const id = interaction.options.getNumber("id", true);
            const {
                type,
                targetId,
                requestAuthorId,
                reason,
                expiresAt,
                updatedAt,
                updatedBy,
                deletedBy,
                deletedAt,
                createdAt,
                executorId,
                flag
            } = await fetchInfraction({ infractionId: id, guildId: interaction.guildId! });

            const fields = [
                {
                    name: "Offender",
                    value: `<@${targetId}>`,
                    inline: true
                },
                {
                    name: "Moderator",
                    value: `<@${executorId}>`,
                    inline: true
                }
            ];

            if (requestAuthorId) {
                fields.push({
                    name: "Requested by",
                    value: `<@${requestAuthorId}>`,
                    inline: true
                });
            }

            if (expiresAt) {
                if (expiresAt > Date.now()) {
                    fields.push({
                        name: "Expires",
                        value: `<t:${expiresAt}:R>`,
                        inline: true
                    });
                } else {
                    fields.push({
                        name: "Duration",
                        value: `${msToString((expiresAt - createdAt) * 1000)}`,
                        inline: true
                    });
                }
            }

            if ((updatedBy && updatedAt) || (deletedBy && deletedAt)) {
                const changes = [];
                const field = {
                    name: "Recent Changes",
                    value: "",
                    inline: false
                };

                if (deletedBy && deletedAt) changes.push(`- Deleted by <@${deletedBy}> (<t:${deletedAt}:R>)`);
                if (updatedBy && updatedAt) changes.push(`- Updated by <@${updatedBy}> (<t:${updatedAt}:R>)`);

                if (changes.length) {
                    field.value = changes.join("\n");
                    fields.push(field);
                }
            }

            const flagName = flag ? `${getInfractionFlagName(flag)} ` : "";
            const embed = new EmbedBuilder()
                .setColor(Colors.NotQuiteBlack)
                .setTitle(`${flagName}${getInfractionName(type)} #${id}`)
                .setFields(fields)
                .setTimestamp(createdAt * 1000);

            if (reason) embed.setDescription(reason);
            await interaction.editReply({ embeds: [embed] });
        }
    }
}