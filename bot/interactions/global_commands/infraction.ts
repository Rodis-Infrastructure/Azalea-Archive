import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    GuildMember,
    Snowflake,
    time,
    User,
    userMention
} from "discord.js";

import {
    currentTimestamp,
    elipsify,
    ensureError,
    formatMuteExpirationResponse,
    formatReason,
    msToString,
    RegexPatterns
} from "@bot/utils";

import {
    InfractionFilter,
    InfractionFlag,
    InfractionModel,
    MinimalInfraction,
    PunishmentType
} from "@database/models/infraction";

import { InfractionSubcommand, InteractionResponseType } from "@bot/types/interactions";
import { getInfractionEmbedData, mapInfractionsToFields } from "@bot/utils/infractions";
import { allQuery, getQuery, runQuery, sanitizeString } from "@database/utils";
import { Command } from "@bot/handlers/interactions/interaction";
import { LoggingEvent, RolePermission } from "@bot/types/config";
import { TimestampStyles } from "@discordjs/formatters";
import { APIEmbedField } from "discord-api-types/v10";
import { sendLog } from "@bot/utils/logging";
import { client } from "@bot/client";

import Config from "@bot/utils/config";
import ms from "ms";

export default class InfractionCommand extends Command {
    constructor() {
        super({
            name: "infraction",
            description: "All infraction-related commands",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: InfractionSubcommand.Info,
                    description: "Get information about an infraction",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{
                        name: "infraction_id",
                        description: "The ID of the infraction",
                        type: ApplicationCommandOptionType.Number,
                        required: true
                    }]
                },
                {
                    name: InfractionSubcommand.Archive,
                    description: "Archive an infraction",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{
                        name: "infraction_id",
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
                            name: "infraction_id",
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
                            name: "infraction_id",
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
                },
                {
                    name: InfractionSubcommand.Search,
                    description: "View a list of infractions",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "user",
                            description: "The user whose infractions to view",
                            type: ApplicationCommandOptionType.User,
                            required: true
                        },
                        {
                            name: "filter_by",
                            description: "The type of infractions to view",
                            type: ApplicationCommandOptionType.String,
                            choices: Object.values(InfractionFilter).map(filter => ({
                                name: filter,
                                value: filter
                            }))
                        }
                    ]
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const subcommand = interaction.options.getSubcommand(true);
        const { emojis } = config;

        if (subcommand === InfractionSubcommand.Search) {
            await handleInfractionSearch(interaction, config, ephemeral);
            return;
        }

        const infractionId = interaction.options.getNumber("infraction_id", true);
        const infraction = await getQuery<InfractionModel, false>(`
            SELECT *
            FROM infractions
            WHERE infraction_id = ${infractionId}
              AND guild_id = ${interaction.guildId}
        `);

        if (subcommand === InfractionSubcommand.Info) {
            const embed = getInfractionInfoEmbed(infraction);

            await interaction.reply({
                embeds: [embed],
                ephemeral
            });

            return;
        }

        // Only actions that require the management permission reach this point (archive, duration, and reason)
        const canManageInfraction = config.canManageInfraction(infraction, interaction.member);

        if (!canManageInfraction) {
            await interaction.reply({
                content: `${emojis.error} You do not have permission to manage this infraction.`,
                ephemeral
            });
            return;
        }

        try {
            let response!: string;

            switch (subcommand) {
                case InfractionSubcommand.Reason: {
                    response = await handleInfractionReasonChange(infractionId, {
                        newReason: interaction.options.getString("new_reason", true),
                        guildId: interaction.guildId,
                        updatedById: interaction.user.id
                    });
                    break;
                }

                case InfractionSubcommand.Duration: {
                    response = await handleInfractionDurationChange(infraction, interaction);
                    break;
                }

                case InfractionSubcommand.Archive: {
                    response = await handleInfractionArchive(infractionId, interaction);
                    break;
                }

                default:
                    await interaction.reply({
                        content: `${emojis.error} Unknown subcommand: \`${subcommand}\``,
                        ephemeral
                    });
                    return;
            }

            const confirmation = config.formatConfirmation(response, {
                executorId: interaction.user.id,
                success: true
            });

            await Promise.all([
                interaction.reply({
                    content: `${emojis.success} Successfully ${response}`,
                    ephemeral
                }),
                config.sendNotification(confirmation, {
                    sourceChannelId: interaction.channelId
                })
            ]);
        } catch (_error) {
            const error = ensureError(_error);
            await interaction.reply({
                content: `${emojis.error} ${error.message}`,
                ephemeral
            });
        }
    }
}

export async function handleInfractionSearch(interaction: ChatInputCommandInteraction<"cached"> | ButtonInteraction<"cached">, config: Config, ephemeral: boolean): Promise<void> {
    let filter: InfractionFilter | null = null;
    let targetMember: GuildMember | null = null;
    let targetUser!: User;

    if (interaction.isChatInputCommand()) {
        targetUser = interaction.options.getUser("user", true);
        targetMember = interaction.options.getMember("user");
        filter = interaction.options.getString("filter_by") as InfractionFilter | null;
    } else {
        targetUser = await client.users.fetch(interaction.customId.split("-")[2]);
    }

    const targetIsStaff = targetMember && config.isGuildStaff(targetMember);
    const executorCanViewModerationActivity = config.hasPermission(interaction.member, RolePermission.ViewModerationActivity);

    if (targetIsStaff && !executorCanViewModerationActivity) {
        await interaction.reply({
            content: `${config.emojis.error} You can't view the infractions of a staff member.`,
            ephemeral
        });
        return;
    }

    let dbQuery: string;

    if (executorCanViewModerationActivity && targetIsStaff) {
        dbQuery = `
            SELECT infraction_id,
                   executor_id,
                   created_at,
                   reason,
                   archived_by,
                   archived_at,
                   flag,
                   expires_at,
                   action
            FROM infractions
            WHERE executor_id = ${interaction.user.id}
              AND guild_id = ${interaction.guildId}
            ORDER BY infraction_id DESC
            LIMIT 100;
        `;
    } else {
        dbQuery = `
            SELECT infraction_id,
                   executor_id,
                   created_at,
                   reason,
                   archived_by,
                   archived_at,
                   flag,
                   expires_at,
                   action
            FROM infractions
            WHERE target_id = ${targetUser.id}
              AND guild_id = ${interaction.guildId}
            ORDER BY created_at DESC
            LIMIT 100;
        `;
    }

    const infractions = await allQuery<MinimalInfraction>(dbQuery);
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    const searchContext = targetIsStaff && executorCanViewModerationActivity ? "by" : "of";
    const embed = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setAuthor({ name: `Infractions ${searchContext} ${targetUser.tag}`, iconURL: targetUser.displayAvatarURL() })
        .setFooter({ text: `ID: ${targetUser.id}` });

    if (filter) embed.setTitle(`Filter: ${filter}`);

    if (!infractions.length) {
        embed.setDescription("This user has no infractions");
    } else {
        const [maxPageCount, fields] = mapInfractionsToFields({
            infractions,
            filter,
            page: 1
        });

        if (fields.length) embed.setFields(fields);
        if (maxPageCount > 1) {
            const nextBtn = new ButtonBuilder()
                .setCustomId(`inf-page-next-${interaction.user.id}`)
                .setLabel("\u2192")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(infractions.length <= 5);

            const pageCountBtn = new ButtonBuilder()
                .setCustomId("inf-page-count")
                .setLabel(`1 / ${maxPageCount}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const previousBtn = new ButtonBuilder()
                .setCustomId(`inf-page-back-${interaction.user.id}`)
                .setLabel("\u2190")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents([previousBtn, pageCountBtn, nextBtn]);
            components.push(actionRow);
        }
    }

    await interaction.reply({
        embeds: [embed],
        components,
        ephemeral: (targetIsStaff && executorCanViewModerationActivity) || ephemeral
    });
}

/**
 * Stores the new reason of an infraction in the database and logs the change
 * @returns {string} A response confirming the change
 */
export async function handleInfractionReasonChange(infractionId: number, data: {
    updatedById: Snowflake,
    guildId: Snowflake,
    newReason: string
}): Promise<string> {
    const { updatedById, guildId, newReason } = data;

    await runQuery(`
        UPDATE infractions
        SET reason     = ${sanitizeString(newReason)},
            updated_at = ${currentTimestamp()},
            updated_by = ${updatedById}
        WHERE infraction_id = ${infractionId}
          AND guild_id = ${guildId};
    `);

    const log = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setAuthor({ name: "Reason Changed", iconURL: "attachment://informationUpdate.png" })
        .setFields([
            {
                name: "Moderator",
                value: userMention(updatedById)
            },
            {
                name: "New Reason",
                value: newReason
            }
        ])
        .setFooter({ text: `#${infractionId}` })
        .setTimestamp();

    await sendLog({
        event: LoggingEvent.Infraction,
        guildId,
        options: {
            embeds: [log],
            files: [{
                attachment: "./icons/informationUpdate.png",
                name: "informationUpdate.png"
            }]
        }
    });

    return `updated the reason of infraction **#${infractionId}**${formatReason(newReason)}`;
}

/**
 * Overrides the duration of an infraction and logs the change
 * @returns {string} A response confirming the change
 */
async function handleInfractionDurationChange(infraction: InfractionModel, interaction: ChatInputCommandInteraction<"cached">): Promise<string> {
    const strDuration = interaction.options.getString("new_duration", true);

    if (!strDuration.match(RegexPatterns.DurationValidation.pattern)) throw new Error("The duration provided is invalid.");

    /** New duration in seconds */
    const duration = Math.floor(ms(strDuration) / 1000);

    if (infraction.action !== PunishmentType.Mute) throw new Error("You can only update the duration of temporary infractions");

    const target = await interaction.guild.members.fetch(infraction.target_id).catch(() => null);

    if (!target) throw new Error("Unable to change the mute duration of a user who is not in the server");
    if (!target.isCommunicationDisabled()) throw new Error("This user does not have an active mute");

    const expiresAt = duration + infraction.created_at;

    try {
        await target.disableCommunicationUntil(expiresAt * 1000, `Mute duration updated (#${infraction.infraction_id})`);
        await runQuery(`
            UPDATE infractions
            SET expires_at = ${expiresAt},
                updated_at = ${currentTimestamp()},
                updated_by = ${interaction.user.id}
            WHERE infraction_id = ${infraction.infraction_id}
              AND guild_id = ${interaction.guildId};
        `);
    } catch (err) {
        console.error(err);
        throw new Error("An error occurred while updating the duration of this infraction");
    }

    const log = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setAuthor({ name: "Duration Changed", iconURL: "attachment://informationUpdate.png" })
        .setFields([
            {
                name: "Moderator",
                value: `${interaction.user}`
            },
            {
                name: "New Duration",
                value: msToString(duration * 1000)
            }
        ])
        .setFooter({ text: `#${infraction.infraction_id}` })
        .setTimestamp();

    await sendLog({
        event: LoggingEvent.Infraction,
        guildId: interaction.guildId,
        options: {
            embeds: [log],
            files: [{
                attachment: "./icons/informationUpdate.png",
                name: "informationUpdate.png"
            }]
        }
    });

    return `updated the duration of infraction **#${infraction.infraction_id}** to ${formatMuteExpirationResponse(expiresAt)}`;
}

/**
 * Archives an infraction and logs the change
 * @returns {string} A response confirming the change
 */
async function handleInfractionArchive(infractionId: number, interaction: ChatInputCommandInteraction<"cached">): Promise<string> {
    try {
        await runQuery(`
            UPDATE infractions
            SET archived_at = ${currentTimestamp()},
                archived_by = ${interaction.user.id}
            WHERE infraction_id = ${infractionId}
              AND guild_id = ${interaction.guildId};
        `);
    } catch (err) {
        console.error(err);
        throw new Error("An error occurred while archiving the infraction");
    }

    const log = new EmbedBuilder()
        .setColor(Colors.Red)
        .setAuthor({ name: "Infraction Archived", iconURL: "attachment://noteDelete.png" })
        .setFields({
            name: "Moderator",
            value: `${interaction.user}`
        })
        .setFooter({ text: `#${infractionId}` })
        .setTimestamp();

    await sendLog({
        event: LoggingEvent.Infraction,
        guildId: interaction.guildId,
        options: {
            embeds: [log],
            files: [{
                attachment: "./icons/noteDelete.png",
                name: "noteDelete.png"
            }]
        }
    });

    return `archived infraction **#${infractionId}**`;
}

function getInfractionInfoEmbed(infraction: InfractionModel): EmbedBuilder {
    const {
        infraction_id,
        action,
        target_id,
        request_author_id,
        reason,
        expires_at,
        updated_at,
        updated_by,
        archived_by,
        archived_at,
        created_at,
        executor_id,
        flag
    } = infraction;

    const msCreatedAt = created_at * 1000;
    const fields: APIEmbedField[] = [
        {
            name: "Offender",
            value: userMention(target_id),
            inline: true
        },
        {
            name: "Moderator",
            value: userMention(executor_id),
            inline: true
        }
    ];

    if (request_author_id) {
        fields.push({
            name: "Requested by",
            value: userMention(request_author_id),
            inline: true
        });
    }

    // The infraction is temporary
    if (expires_at) {
        const msExpiresAt = expires_at * 1000;

        if (msExpiresAt > Date.now()) {
            fields.push({
                name: "Expires",
                value: time(expires_at, TimestampStyles.RelativeTime),
                inline: true
            });
        } else {
            fields.push({
                name: "Duration",
                value: msToString(msExpiresAt - msCreatedAt),
                inline: true
            });
        }
    }

    const recentChanges: string[] = [];

    if (archived_by && archived_at) recentChanges.push(`- Archived by ${userMention(archived_by)} (${time(archived_at, TimestampStyles.RelativeTime)})`);
    if (updated_by && updated_at) recentChanges.push(`- Updated by ${userMention(updated_by)} (${time(updated_at, TimestampStyles.RelativeTime)})`);

    if (recentChanges.length) {
        fields.push({
            name: "Recent Changes",
            value: recentChanges.join("\n"),
            inline: false
        });
    }

    if (reason) {
        fields.push({
            name: "Reason",
            value: elipsify(reason, 1024),
            inline: false
        });
    }

    const { color } = getInfractionEmbedData(action);
    const title: string[] = [];

    if (flag) title.push(InfractionFlag[flag]);

    title.push(PunishmentType[action]);
    title.push(`#${infraction_id}`);

    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title.join(" "))
        .setFields(fields)
        .setTimestamp(msCreatedAt);
}