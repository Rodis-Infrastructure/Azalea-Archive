import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    GuildMember,
    inlineCode,
    time
} from "discord.js";

import { InfractionCount, PunishmentType } from "../../types/db";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { mapInfractionCount } from "../../utils/infractions";
import { TimestampStyles } from "@discordjs/formatters";
import { RolePermission } from "../../types/config";
import { getQuery } from "../../db";

import Config from "../../utils/config";

export default class InfoCommand extends Command {
    constructor() {
        super({
            name: "info",
            description: "Get information about a user.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [{
                name: "user",
                description: "The user to get information about.",
                type: ApplicationCommandOptionType.User
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const components = [];
        const flags = [];

        let targetMember = interaction.options.getMember("user") as GuildMember | null;

        if (targetUser.bot) flags.push("Bot");
        if (!targetMember && targetUser.id === interaction.user.id) targetMember = interaction.member as GuildMember;

        const embed = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({
                name: targetUser.tag,
                iconURL: targetUser.displayAvatarURL(),
                url: targetUser.displayAvatarURL()
            })
            .setFooter({ text: `ID: ${targetUser.id}` });

        const relativeCreatedTimestamp = time(targetUser.createdAt.getTime(), TimestampStyles.RelativeTime);

        if (targetMember) {
            flags.push(...config.userFlags(targetMember));

            if (config.isGuildStaff(targetMember)) flags.push("Staff");
            if (targetMember.isCommunicationDisabled()) flags.push("Muted");

            const relativeJoinedTimestamp = time(targetMember.joinedAt!.getTime(), TimestampStyles.RelativeTime);

            embed.addFields([
                {
                    name: targetMember.nickname ? "Nickname" : "Display Name",
                    // Server nickname OR Global display name OR Username
                    value: targetMember.nickname || targetMember.displayName,
                    inline: true
                },
                {
                    name: "Created",
                    value: relativeCreatedTimestamp,
                    inline: true
                },
                {
                    name: "Joined",
                    value: relativeJoinedTimestamp,
                    inline: true
                }
            ]);
        } else {
            embed.setColor(Colors.Red);
            embed.setFields({
                name: "Created",
                value: relativeCreatedTimestamp,
                inline: true
            });

            const targetIsBanned = await interaction.guild!.bans.fetch(targetUser.id)
                .then(() => true)
                .catch(() => false);

            if (targetIsBanned) {
                const ban = await getQuery<{ reason: string }>(`
                    SELECT reason
                    FROM infractions
                    WHERE target_id = ${targetUser.id}
                      AND guild_id = ${interaction.guildId!}
                      AND action = ${PunishmentType.Ban}
                    ORDER BY infraction_id DESC
                    LIMIT 1;
                `);

                embed.setTitle("Banned");
                embed.setDescription(ban?.reason || "No reason provided.");
            } else {
                embed.setDescription("This user is not a member of the server.");
            }
        }

        // Only allows staff to view member infractions, but not the infractions of other staff
        if (!flags.includes("Staff") && config.isGuildStaff(interaction.member as GuildMember)) {
            const infractionCount = await getQuery<InfractionCount, false>(`
                SELECT SUM(action = ${PunishmentType.Note}) AS note,
                       SUM(action = ${PunishmentType.Mute}) AS mute,
                       SUM(action = ${PunishmentType.Kick}) AS kick,
                       SUM(action = ${PunishmentType.Ban})  AS ban
                FROM infractions
                WHERE target_id = ${targetUser.id}
                  AND guild_id = ${interaction.guildId!};

            `);

            embed.addFields({
                name: "Infractions",
                value: mapInfractionCount(infractionCount),
                inline: flags.length > 0
            });

            const infractionsBtn = new ButtonBuilder()
                .setLabel("Infractions")
                .setCustomId(`inf-search-${targetUser.id}`)
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(infractionsBtn);
            components.push(actionRow);
        }

        if (
            flags.includes("Staff") &&
            config.hasPermission(interaction.member as GuildMember, RolePermission.ViewModerationActivity)
        ) {
            ephemeral = true;
            const dealtInfractionCount = await getQuery<InfractionCount>(`
                SELECT SUM(action = ${PunishmentType.Note}) AS note,
                       SUM(action = ${PunishmentType.Mute}) AS mute,
                       SUM(action = ${PunishmentType.Kick}) AS kick,
                       SUM(action = ${PunishmentType.Ban})  AS ban
                FROM infractions
                WHERE (target_id = ${targetUser.id} OR request_author_id = ${targetUser.id})
                  AND guild_id = ${interaction.guildId!};

            `);

            if (dealtInfractionCount) {
                embed.addFields({
                    name: "Infractions Dealt",
                    value: mapInfractionCount(dealtInfractionCount),
                    inline: true
                });
            }
        }

        if (flags.length) {
            embed.addFields([
                {
                    name: "Flags",
                    value: inlineCode(flags.join("`\n`")),
                    inline: true
                },
                // Empty field to improve the layout
                {
                    name: "\u200b",
                    value: "\u200b",
                    inline: true
                }
            ]);
        }

        await interaction.reply({
            embeds: [embed],
            components,
            ephemeral
        });
    }
}