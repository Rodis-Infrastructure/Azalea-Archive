import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    inlineCode,
    time
} from "discord.js";

import { InfractionCount, InfractionModel, PunishmentType } from "@database/models/infraction";
import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { mapInfractionCount } from "@bot/utils/infractions";
import { TimestampStyles } from "@discordjs/formatters";
import { RolePermission } from "@bot/types/config";
import { db } from "@database/utils.ts";

import Config from "@bot/utils/config";

export default class InfoCommand extends Command {
    constructor() {
        super({
            name: "info",
            description: "Get information about a user.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipEphemeralCheck: false,
            options: [{
                name: "user",
                description: "The user to get information about.",
                type: ApplicationCommandOptionType.User
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        const flags: string[] = [];

        let targetMember = interaction.options.getMember("user");

        if (targetUser.bot) flags.push("Bot");
        if (!targetMember && targetUser.id === interaction.user.id) targetMember = interaction.member;

        const embed = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({
                name: targetUser.tag,
                iconURL: targetUser.displayAvatarURL(),
                url: targetUser.displayAvatarURL()
            })
            .setFooter({ text: `ID: ${targetUser.id}` });

        const relativeCreatedTimestamp = time(targetUser.createdAt, TimestampStyles.RelativeTime);

        if (targetMember) {
            flags.push(...config.userFlags(targetMember));

            if (config.isGuildStaff(targetMember)) flags.push("Staff");
            if (targetMember.isCommunicationDisabled()) flags.push("Muted");

            const relativeJoinedTimestamp = time(targetMember.joinedAt!, TimestampStyles.RelativeTime);

            embed.addFields([
                {
                    name: targetMember.nickname ? "Nickname" : "Display Name",
                    // Server nickname OR Global display name OR Username
                    value: targetMember.displayName,
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

            // We're not using the reason from the fetched ban
            // because it won't be up-to-date if the infraction was modified
            const targetIsBanned = await interaction.guild.bans.fetch(targetUser.id)
                .then(() => true)
                .catch(() => false);

            if (targetIsBanned) {
                const ban = await db.get<Pick<InfractionModel, "reason">>(`
                    SELECT reason
                    FROM infractions
                    WHERE target_id = $targetId
                      AND guild_id = $guildId
                      AND action = $action
                    ORDER BY infraction_id DESC
                    LIMIT 1;
                `, [{
                    $targetId: targetUser.id,
                    $guildId: interaction.guildId,
                    $action: PunishmentType.Ban
                }]);

                embed.setTitle("Banned");
                embed.setDescription(ban?.reason ?? "No reason provided.");
            } else {
                embed.setDescription("This user is not a member of the server.");
            }
        }

        // Only allows staff to view member infractions, but not the infractions of other staff
        if (!flags.includes("Staff") && config.isGuildStaff(interaction.member)) {
            const infractionCount = await db.get<InfractionCount, false>(`
                SELECT SUM(action = ${PunishmentType.Note}) AS note,
                       SUM(action = ${PunishmentType.Mute}) AS mute,
                       SUM(action = ${PunishmentType.Kick}) AS kick,
                       SUM(action = ${PunishmentType.Ban})  AS ban
                FROM infractions
                WHERE target_id = $targetId
                  AND guild_id = $guildId;
            `, [{
                $targetId: targetUser.id,
                $guildId: interaction.guildId
            }]);

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
            config.hasPermission(interaction.member, RolePermission.ViewModerationActivity)
        ) {
            ephemeral = true;
            const dealtInfractionCount = await db.get<InfractionCount, false>(`
                SELECT SUM(action = ${PunishmentType.Note}) AS note,
                       SUM(action = ${PunishmentType.Mute}) AS mute,
                       SUM(action = ${PunishmentType.Kick}) AS kick,
                       SUM(action = ${PunishmentType.Ban})  AS ban
                FROM infractions
                WHERE (executor_id = $targetId OR request_author_id = $targetId)
                  AND guild_id = $guildId;
            `, [{
                $targetId: targetUser.id,
                $guildId: interaction.guildId
            }]);

            embed.addFields({
                name: "Infractions Dealt",
                value: mapInfractionCount(dealtInfractionCount),
                inline: true
            });
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