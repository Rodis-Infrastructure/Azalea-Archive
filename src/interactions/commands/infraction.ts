import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    Collection,
    Colors,
    EmbedBuilder,
    GuildMember,
    User
} from "discord.js";

import {
    currentTimestamp,
    elipsify,
    formatReason,
    formatTimestamp,
    getInfractionFlagName,
    getPunishmentEmbedColor,
    getPunishmentType,
    mapInfractionsToFields,
    msToString,
    MUTE_DURATION_VALIDATION_REGEX
} from "../../utils";

import { InfractionSubcommand, InteractionResponseType } from "../../types/interactions";
import { Infraction, InfractionPunishment, MinimalInfraction } from "../../types/db";
import { InfractionFilter } from "../../types/utils";
import { allQuery, getQuery, runQuery } from "../../db";
import { sendLog } from "../../utils/logging";

import ChatInputCommand from "../../handlers/interactions/commands/chatInputCommand";
import ClientManager from "../../client";
import Config from "../../utils/config";
import ms from "ms";
import { LoggingEvent } from "../../types/config";

export default class InfractionCommand extends ChatInputCommand {
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

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const subcommand = interaction.options.getSubcommand();
        const id = interaction.options.getNumber("id") as number;
        const infraction = await getQuery<Infraction>(`
            SELECT *
            FROM infractions
            WHERE infraction_id = ${id}
              AND guild_id = ${interaction.guildId}
        `) as Infraction;

        const { error, success } = config.emojis;

        switch (subcommand) {
            case InfractionSubcommand.Delete:
            case InfractionSubcommand.Reason:
            case InfractionSubcommand.Duration: {
                try {
                    await config.canManageInfraction(infraction, interaction.member as GuildMember);
                } catch (err) {
                    await interaction.reply({
                        content: `${error} ${err}`,
                        ephemeral
                    });
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
                case InfractionSubcommand.Search: {
                    await handleUserInfractionSearch(interaction, config, ephemeral);
                    return;
                }
                case InfractionSubcommand.Info: {
                    const embed = handleInfractionInfo(infraction);
                    await interaction.reply({
                        embeds: [embed],
                        ephemeral
                    });
                    return;
                }
                default:
                    await interaction.reply({
                        content: `${error} Unknown subcommand: \`${subcommand}\``,
                        ephemeral
                    });
                    return;
            }

            await Promise.all([
                interaction.reply({
                    content: `${success} Successfully ${response}`,
                    ephemeral
                }),
                config.sendConfirmation({
                    guild: interaction.guild!,
                    message: response,
                    authorId: interaction.user.id,
                    channelId: interaction.channelId
                })
            ]);
        } catch (err) {
            await interaction.reply({
                content: `${error} ${err}`,
                ephemeral
            });
        }
    }
}

export async function handleUserInfractionSearch(interaction: ChatInputCommandInteraction | ButtonInteraction, config: Config, ephemeral: boolean) {
    let filter: InfractionFilter | null = null;
    let member: GuildMember | null = null;
    let user!: User;

    if (interaction.isChatInputCommand()) {
        user = interaction.options.getUser("user", true);
        member = interaction.options.getMember("user") as GuildMember | null;
        filter = interaction.options.getString("filter_by") as InfractionFilter | null;
    } else {
        user = await ClientManager.client.users.fetch(interaction.customId.split("-")[2]);
    }

    if (member && config.isGuildStaff(member)) {
        await interaction.reply({
            content: `${config.emojis.error} You can't view the infractions of a staff member.`,
            ephemeral
        });
        return;
    }

    const cachedInfractions = ClientManager.cache.infractions.get(user.id);
    let infractions = cachedInfractions?.data || [];

    if (!cachedInfractions) {
        infractions = await allQuery<MinimalInfraction>(`
            SELECT infraction_id,
                   executor_id,
                   created_at,
                   reason,
                   deleted_by,
                   deleted_at,
                   flag,
                   expires_at,
                   action
            FROM infractions
            WHERE target_id = ${user.id}
              AND guild_id = ${interaction.guildId}
            ORDER BY created_at DESC
        `) || [];
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    const embed = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setAuthor({ name: `Infractions of ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setFooter({ text: `ID: ${user.id}` });

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
                .setCustomId(`inf-page-next-${user.id}`)
                .setLabel("\u2192")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(infractions.length <= 5);

            const pageCountBtn = new ButtonBuilder()
                .setCustomId("x")
                .setLabel(`1 / ${maxPageCount}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const previousBtn = new ButtonBuilder()
                .setCustomId(`inf-page-back-${user.id}`)
                .setLabel("\u2190")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents([previousBtn, pageCountBtn, nextBtn]);
            components.push(actionRow);
        }
    }

    const message = await interaction.reply({
        fetchReply: true,
        embeds: [embed],
        components,
        ephemeral
    });

    let timeout!: NodeJS.Timeout | undefined;

    if (components.length) {
        timeout = setTimeout(() => {
            ClientManager.cache.infractions.delete(user.id);
        }, 300_000);
    }

    const messageData = {
        authorId: interaction.user.id,
        filter,
        page: 1
    };

    if (cachedInfractions) {
        if (timeout) {
            clearTimeout(cachedInfractions.timeout);
            cachedInfractions.timeout = timeout;
        }

        cachedInfractions.messages.set(message.id, messageData);
    } else if (components.length) {
        ClientManager.cache.infractions.set(user.id, {
            data: infractions,
            messages: new Collection([[message.id, messageData]]),
            timeout
        });
    }
}

async function handleReasonChange(infractionId: number, interaction: ChatInputCommandInteraction): Promise<string> {
    const newReason = interaction.options.getString("new_reason", true);

    try {
        await runQuery(`
            UPDATE infractions
            SET reason     = '${newReason}',
                updated_at = ${currentTimestamp()},
                updated_by = ${interaction.user.id}
            WHERE infraction_id = ${infractionId}
              AND guild_id = ${interaction.guildId};
        `);
    } catch (err) {
        console.error(err);
        throw "An error occurred while updating the reason of the infraction";
    }

    const log = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setAuthor({ name: "Reason Changed", iconURL: "attachment://infractionUpdate.png" })
        .setFields([
            {
                name: "Moderator",
                value: `${interaction.user}`
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
        guildId: interaction.guildId!,
        options: {
            embeds: [log],
            files: [{
                attachment: "./icons/infractionUpdate.png",
                name: "infractionUpdate.png"
            }]
        }
    });

    return `updated the reason of infraction **#${infractionId}**${formatReason(newReason)}`;
}

async function handleDurationChange(infraction: Infraction, interaction: ChatInputCommandInteraction): Promise<string> {
    const strDuration = interaction.options.getString("new_duration", true);
    if (!strDuration.match(MUTE_DURATION_VALIDATION_REGEX)) throw "The duration provided is invalid.";

    const duration = Math.floor(ms(strDuration) / 1000);
    const now = currentTimestamp();

    if (infraction.action !== InfractionPunishment.Mute) throw "You can only update the duration of mute infractions";

    const offender = await interaction.guild!.members.fetch(infraction.target_id);
    if (!offender.isCommunicationDisabled()) throw "This user does not have an active mute";

    const expiresAt = duration + infraction.created_at;

    try {
        await offender.disableCommunicationUntil(expiresAt * 1000, `Mute duration updated (#${infraction.infraction_id})`);
        await runQuery(`
            UPDATE infractions
            SET expires_at = ${expiresAt},
                updated_at = ${now},
                updated_by = ${interaction.user.id}
            WHERE infraction_id = ${infraction.infraction_id}
              AND guild_id = ${interaction.guildId};
        `);
    } catch (err) {
        console.error(err);
        throw "An error occurred while updating the duration of the mute";
    }

    const log = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setAuthor({ name: "Duration Changed", iconURL: "attachment://infractionUpdate.png" })
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
        guildId: interaction.guildId!,
        options: {
            embeds: [log],
            files: [{
                attachment: "./icons/infractionUpdate.png",
                name: "infractionUpdate.png"
            }]
        }
    });

    return `updated the duration of infraction **#${infraction.infraction_id}** to ${formatTimestamp(expiresAt, "F")} | Expires ${formatTimestamp(expiresAt, "R")}`;
}

async function handleInfractionDeletion(infractionId: number, interaction: ChatInputCommandInteraction): Promise<string> {
    try {
        await runQuery(`
            UPDATE infractions
            SET deleted_at = ${currentTimestamp()},
                deleted_by = ${interaction.user.id}
            WHERE infraction_id = ${infractionId}
              AND guild_id = ${interaction.guildId};
        `);
    } catch (err) {
        console.error(err);
        throw "An error occurred while deleting the infraction";
    }

    const log = new EmbedBuilder()
        .setColor(Colors.Red)
        .setAuthor({ name: "Infraction Deleted", iconURL: "attachment://infractionDelete.png" })
        .setFields({
            name: "Moderator",
            value: `${interaction.user}`
        })
        .setFooter({ text: `#${infractionId}` })
        .setTimestamp();

    await sendLog({
        event: LoggingEvent.Infraction,
        guildId: interaction.guildId!,
        options: {
            embeds: [log],
            files: [{
                attachment: "./icons/infractionDelete.png",
                name: "infractionDelete.png"
            }]
        }
    });

    return `deleted infraction **#${infractionId}**`;
}

function handleInfractionInfo(infraction: Infraction): EmbedBuilder {
    const {
        infraction_id,
        action,
        target_id,
        request_author_id,
        reason,
        expires_at,
        updated_at,
        updated_by,
        deleted_by,
        deleted_at,
        created_at,
        executor_id,
        flag
    } = infraction;

    const msCreatedAt = created_at * 1000;
    const fields = [
        {
            name: "Offender",
            value: `<@${target_id}>`,
            inline: true
        },
        {
            name: "Moderator",
            value: `<@${executor_id}>`,
            inline: true
        }
    ];

    if (request_author_id) {
        fields.push({
            name: "Requested by",
            value: `<@${request_author_id}>`,
            inline: true
        });
    }

    /* The infraction is temporary */
    if (expires_at) {
        const msExpiresAt = expires_at * 1000;

        if (msExpiresAt > Date.now()) {
            fields.push({
                name: "Expires",
                value: formatTimestamp(expires_at, "R"),
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
    if ((updated_by && updated_at) || (deleted_by && deleted_at)) {
        const changes = [];

        if (deleted_by && deleted_at) changes.push(`- Deleted by <@${deleted_by}> (${formatTimestamp(deleted_at, "R")})`);
        if (updated_by && updated_at) changes.push(`- Updated by <@${updated_by}> (${formatTimestamp(updated_at, "R")})`);

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
        .setColor(getPunishmentEmbedColor(action))
        .setTitle(`${flagName}${getPunishmentType(action)} #${infraction_id}`)
        .setFields(fields)
        .setTimestamp(msCreatedAt);
}