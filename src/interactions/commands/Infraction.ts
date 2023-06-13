import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember
} from "discord.js";

import { Infraction, InfractionSubcommand, InteractionResponseType, TInfraction } from "../../utils/Types";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import { getQuery, runQuery } from "../../db";
import {
    DURATION_FORMAT_REGEX,
    elipsify,
    getInfractionColor,
    getInfractionFlagName,
    getInfractionName,
    msToString
} from "../../utils";
import Config from "../../utils/Config";
import ms from "ms";

export default class InfractionCommand extends ChatInputCommand {
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
                },
                {
                    name: InfractionSubcommand.Delete,
                    description: "Delete an infraction",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{
                        name: "id",
                        description: "The ID of the infraction",
                        type: ApplicationCommandOptionType.Number,
                        required: true
                    }]
                },
                {
                    name: InfractionSubcommand.Reason,
                    description: "Update the reason of an infraction",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "id",
                            description: "The ID of the infraction",
                            type: ApplicationCommandOptionType.Number,
                            required: true
                        },
                        {
                            name: "new_reason",
                            description: "The new reason of the infraction",
                            type: ApplicationCommandOptionType.String,
                            max_length: 1024,
                            required: true
                        }
                    ]
                },
                {
                    name: InfractionSubcommand.Duration,
                    description: "Update the duration of a mute",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "id",
                            description: "The ID of the infraction",
                            type: ApplicationCommandOptionType.Number,
                            required: true
                        },
                        {
                            name: "new_duration",
                            description: "The new duration of the mute",
                            type: ApplicationCommandOptionType.String,
                            required: true
                        }
                    ]
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        const subcommand = interaction.options.getSubcommand();
        const id = interaction.options.getNumber("id", true);
        const guildId = interaction.guildId!;
        let infraction!: Infraction;

        const { error, success } = config.emojis;

        switch (subcommand) {
            case InfractionSubcommand.Delete:
            case InfractionSubcommand.Reason:
            case InfractionSubcommand.Duration: {
                try {
                    infraction = await config.canManageInfraction({
                        infractionId: id,
                        member: interaction.member as GuildMember
                    });
                } catch (err) {
                    await interaction.editReply(`${error} ${err}`);
                    return;
                }
            }
        }

        if (subcommand === InfractionSubcommand.Reason) {
            const reason = interaction.options.getString("new_reason", true);

            try {
                await runQuery(`
					UPDATE infractions
					SET reason    = '${reason}',
						updatedAt = ${Math.floor(Date.now() / 1000)},
						updatedBy = ${interaction.user.id}
					WHERE id = ${id}
					  AND guildId = ${guildId};
                `);

                await interaction.editReply(`${success} Successfully updated the reason of infraction **#${id}**`);
            } catch (err) {
                console.error(err);
                await interaction.editReply(`${error} An error occurred while updating the reason of the infraction`);
            }
        }

        if (subcommand === InfractionSubcommand.Duration) {
            const strDuration = interaction.options.getString("new_duration", true);

            if (!strDuration.match(DURATION_FORMAT_REGEX)) {
                await interaction.editReply(`${error} The duration provided is invalid.`);
                return;
            }

            const duration = Math.floor(ms(strDuration) / 1000);
            const now = Math.floor(Date.now() / 1000);

            try {
                if (infraction.type !== TInfraction.Mute) {
                    await interaction.editReply(`${error} You can only update the duration of mute infractions`);
                    return;
                }

                const offender = await interaction.guild!.members.fetch(infraction.targetId);

                if (!offender.isCommunicationDisabled()) {
                    await interaction.editReply(`${error} The user is not muted`);
                    return;
                }

                const expiresAt = duration + infraction.createdAt;
                await Promise.all([
                    offender.disableCommunicationUntil(expiresAt * 1000, `Mute duration updated (#${id})`),
                    runQuery(`
						UPDATE infractions
						SET expiresAt = ${expiresAt},
							updatedAt = ${now},
							updatedBy = ${interaction.user.id}
						WHERE id = ${id}
						  AND guildId = ${guildId};
                    `)
                ]);

                await interaction.editReply(`${success} Successfully updated the mute duration of **${offender.user.tag}** to <t:${expiresAt}:F> | Expires <t:${expiresAt}:R>`);
            } catch (err) {
                console.error(err);
                await interaction.editReply(`${error} An error occurred while updating the duration of the mute`);
            }
        }

        if (subcommand === InfractionSubcommand.Delete) {
            try {
                await runQuery(`
					UPDATE infractions
					SET deletedAt = ${Math.floor(Date.now() / 1000)},
						deletedBy = ${interaction.user.id}
					WHERE id = ${id}
					  AND guildId = ${guildId};
                `);

                await interaction.editReply(`${success} Successfully deleted infraction **#${id}**`);
            } catch (err) {
                console.error(err);
                await interaction.editReply(`${error} An error occurred while deleting the infraction`);
            }

            return;
        }

        if (subcommand === InfractionSubcommand.Info) {
            const id = interaction.options.getNumber("id", true);
            const infraction = await getQuery<Infraction>(`
				SELECT *
				FROM infractions
				WHERE id = ${id}
				  AND guildId = ${guildId};
            `);

            if (!infraction) {
                await interaction.editReply(`${error} Infraction **#${id}** not found`);
                return;
            }

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
            } = infraction;

            const msCreatedAt = createdAt * 1000;
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
                const msExpiresAt = expiresAt * 1000;

                if (msExpiresAt > Date.now() && offender.isCommunicationDisabled()) {
                    fields.push({
                        name: "Expires",
                        value: `<t:${expiresAt}:R>`,
                        inline: true
                    });
                } else {
                    fields.push({
                        name: "Duration",
                        value: `${msToString(msExpiresAt - msCreatedAt)}`,
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
                .setTimestamp(msCreatedAt);

            await interaction.editReply({ embeds: [embed] });
        }
    }
}