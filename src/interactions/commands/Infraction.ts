import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    EmbedBuilder
} from "discord.js";

import { InfractionSubcommand, InteractionResponseType } from "../../utils/Types";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import { fetchInfraction } from "../../db";
import { elipsify, getInfractionColor, getInfractionFlagName, getInfractionName, msToString } from "../../utils";

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

            const createdAtMs = createdAt * 1000;
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
                const offender = await interaction.guild!.members.fetch(targetId);
                const expiresAtMs = expiresAt * 1000;

                if (expiresAtMs > Date.now() && offender.isCommunicationDisabled()) {
                    fields.push({
                        name: "Expires",
                        value: `<t:${expiresAt}:R>`,
                        inline: true
                    });
                } else {
                    fields.push({
                        name: "Duration",
                        value: `${msToString(expiresAtMs - createdAtMs)}`,
                        inline: true
                    });
                }
            }

            if ((updatedBy && updatedAt) || (deletedBy && deletedAt)) {
                const changes = [];

                if (deletedBy && deletedAt) changes.push(`- Deleted by <@${deletedBy}> (<t:${deletedAt}:R>)`);
                if (updatedBy && updatedAt) changes.push(`- Updated by <@${updatedBy}> (<t:${updatedAt}:R>)`);

                if (changes.length) {
                    fields.push({
                        name: "Recent Changes",
                        value: changes.join("\n"),
                        inline: false
                    });
                }
            }

            if (reason) {
                fields.push({
                    name: "Reason",
                    value: elipsify(reason, 1024),
                    inline: false
                });
            }

            const flagName = flag ? `${getInfractionFlagName(flag)} ` : "";
            const embed = new EmbedBuilder()
                .setColor(getInfractionColor(type))
                .setTitle(`${flagName}${getInfractionName(type)} #${id}`)
                .setFields(fields)
                .setTimestamp(createdAtMs);

            await interaction.editReply({ embeds: [embed] });
        }
    }
}