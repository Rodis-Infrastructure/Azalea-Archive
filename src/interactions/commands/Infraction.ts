import { Infraction, InfractionSubcommand, InteractionResponseType, TInfraction } from "../../utils/Types";
import { getQuery, runQuery } from "../../db";

import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember
} from "discord.js";

import {
    DURATION_FORMAT_REGEX,
    elipsify,
    formatReason,
    formatTimestamp,
    getInfractionColor,
    getInfractionFlagName,
    getInfractionName,
    msToString
} from "../../utils";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
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
        const infraction = await getQuery<Infraction>(`
			SELECT *
			FROM infractions
			WHERE id = ${id}
			  AND guildId = ${interaction.guildId}
        `) as Infraction;

        const { error, success } = config.emojis;

        switch (subcommand) {
            case InfractionSubcommand.Delete:
            case InfractionSubcommand.Reason:
            case InfractionSubcommand.Duration: {
                try {
                    await config.canManageInfraction(infraction, interaction.member as GuildMember);
                } catch (err) {
                    await interaction.editReply(`${error} ${err}`);
                    return;
                }
            }
        }

        try {
            let response!: string;

            switch (subcommand) {
                case InfractionSubcommand.Reason:
                    response = await handleReasonChange(id, interaction);
                    break;
                case InfractionSubcommand.Duration:
                    response = await handleDurationChange(infraction, interaction);
                    break;
                case InfractionSubcommand.Delete:
                    response = await handleInfractionDeletion(id, interaction);
                    break;
                case InfractionSubcommand.Info: {
                    const embed = handleInfractionInfo(infraction);
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
                default:
                    await interaction.editReply(`${error} Unknown subcommand: \`${subcommand}\``);
                    return;
            }

            await Promise.all([
                interaction.editReply(`${success} Successfully ${response}`),
                config.sendInfractionConfirmation({
                    guild: interaction.guild!,
                    message: response,
                    authorId: interaction.user.id,
                    channelId: interaction.channelId
                })
            ]);
        } catch (err) {
            await interaction.editReply(`${error} ${err}`);
        }
    }
}

async function handleReasonChange(infractionId: number, interaction: ChatInputCommandInteraction): Promise<string> {
    const newReason = interaction.options.getString("new_reason", true);

    try {
        await runQuery(`
			UPDATE infractions
			SET reason    = '${newReason}',
				updatedAt = ${Math.floor(Date.now() / 1000)},
				updatedBy = ${interaction.user.id}
			WHERE id = ${infractionId}
			  AND guildId = ${interaction.guildId};
        `);
    } catch (err) {
        console.error(err);
        throw "An error occurred while updating the reason of the infraction";
    }

    return `updated the reason of infraction **#${infractionId}**${formatReason(newReason)}`;
}

async function handleDurationChange(infraction: Infraction, interaction: ChatInputCommandInteraction): Promise<string> {
    const strDuration = interaction.options.getString("new_duration", true);
    if (!strDuration.match(DURATION_FORMAT_REGEX)) throw "The duration provided is invalid.";

    const duration = Math.floor(ms(strDuration) / 1000);
    const now = Math.floor(Date.now() / 1000);

    if (infraction.type !== TInfraction.Mute) throw "You can only update the duration of mute infractions";

    const offender = await interaction.guild!.members.fetch(infraction.targetId);
    if (!offender.isCommunicationDisabled()) throw "This user does not have an active mute";

    const expiresAt = duration + infraction.createdAt;

    try {
        await offender.disableCommunicationUntil(expiresAt * 1000, `Mute duration updated (#${infraction.id})`);
        await runQuery(`
			UPDATE infractions
			SET expiresAt = ${expiresAt},
				updatedAt = ${now},
				updatedBy = ${interaction.user.id}
			WHERE id = ${infraction.id}
			  AND guildId = ${interaction.guildId};
        `);
    } catch (err) {
        console.error(err);
        throw "An error occurred while updating the duration of the mute";
    }

    return `updated the duration of infraction **#${infraction.id}** to ${formatTimestamp(expiresAt, "F")} | Expires ${formatTimestamp(expiresAt, "R")}`;
}

async function handleInfractionDeletion(infractionId: number, interaction: ChatInputCommandInteraction): Promise<string> {
    try {
        await runQuery(`
			UPDATE infractions
			SET deletedAt = ${Math.floor(Date.now() / 1000)},
				deletedBy = ${interaction.user.id}
			WHERE id = ${infractionId}
			  AND guildId = ${interaction.guildId};
        `);
    } catch (err) {
        console.error(err);
        throw "An error occurred while deleting the infraction";
    }

    return `deleted infraction **#${infractionId}**`;
}

function handleInfractionInfo(infraction: Infraction): EmbedBuilder {
    const {
        id,
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

    /* The infraction is temporary */
    if (expiresAt) {
        const msExpiresAt = expiresAt * 1000;

        if (msExpiresAt > Date.now()) {
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

    /* The infraction has either been updated or deleted */
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
    return new EmbedBuilder()
        .setColor(getInfractionColor(type))
        .setTitle(`${flagName}${getInfractionName(type)} #${id}`)
        .setFields(fields)
        .setTimestamp(msCreatedAt);
}