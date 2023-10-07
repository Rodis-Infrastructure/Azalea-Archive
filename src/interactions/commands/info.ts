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
    inlineCode
} from "discord.js";

import { InfractionCount, PunishmentType } from "../../types/db";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { mapInfractionCount } from "../../utils/infractions";
import { discordTimestamp } from "../../utils";
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
        const user = interaction.options.getUser("user") || interaction.user;
        const components = [];
        const flags = [];

        let member = interaction.options.getMember("user") as GuildMember;

        if (user.bot) flags.push("Bot");
        if (!member && user.id === interaction.user.id) member = interaction.member as GuildMember;

        const embed = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL(),
                url: user.displayAvatarURL()
            })
            .setFooter({ text: `ID: ${user.id}` });

        if (member) {
            flags.push(...config.userFlags(member));

            if (config.isGuildStaff(member)) flags.push("Staff");
            if (member.isCommunicationDisabled()) flags.push("Muted");

            embed.addFields([
                {
                    name: member.nickname ? "Nickname" : "Display Name",
                    value: member.nickname || member.displayName,
                    inline: true
                },
                {
                    name: "Created",
                    value: discordTimestamp(Math.floor(user.createdTimestamp / 1000), "R"),
                    inline: true
                },
                {
                    name: "Joined",
                    value: discordTimestamp(Math.floor(member.joinedTimestamp as number / 1000), "R"),
                    inline: true
                }
            ]);
        } else {
            embed.setColor(Colors.Red);
            embed.setFields({
                name: "Created",
                value: discordTimestamp(Math.floor(user.createdTimestamp / 1000), "R"),
                inline: true
            });

            const ban = await interaction.guild!.bans.fetch(user.id)
                .then(() => true)
                .catch(() => false);

            if (ban) {
                const banData = await getQuery<{ reason: string }>(`
                    SELECT reason
                    FROM infractions
                    WHERE target_id = ${user.id}
                      AND guild_id = ${interaction.guildId!}
                      AND action = ${PunishmentType.Ban}
                    ORDER BY infraction_id DESC
                    LIMIT 1;
                `);

                embed.setTitle("Banned");
                embed.setDescription(banData?.reason || "No reason provided.");
            } else {
                embed.setDescription("This user is not a member of the server.");
            }
        }

        /* Only allows staff to view member infractions, but not the infractions of other staff */
        if (!flags.includes("Staff") && config.isGuildStaff(interaction.member as GuildMember)) {
            const infractionCount = await getQuery<InfractionCount, true>(`
                SELECT SUM(action = ${PunishmentType.Note}) AS note,
                       SUM(action = ${PunishmentType.Mute}) AS mute,
                       SUM(action = ${PunishmentType.Kick}) AS kick,
                       SUM(action = ${PunishmentType.Ban})  AS ban
                FROM infractions
                WHERE target_id = ${user.id}
                  AND guild_id = ${interaction.guildId!};

            `);

            embed.addFields({
                name: "Infractions",
                value: mapInfractionCount(infractionCount),
                inline: flags.length > 0
            });

            const infractionsBtn = new ButtonBuilder()
                .setLabel("Infractions")
                .setCustomId(`inf-search-${user.id}`)
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(infractionsBtn);
            components.push(actionRow);
        }

        if (
            flags.includes("Staff") &&
            config.hasPermission(interaction.member as GuildMember, {
                permission: "viewModerationActivity",
                requiredValue: true
            })
        ) {
            ephemeral = true;
            const dealtInfCount = await getQuery<InfractionCount>(`
                SELECT SUM(action = ${PunishmentType.Note}) AS note,
                       SUM(action = ${PunishmentType.Mute}) AS mute,
                       SUM(action = ${PunishmentType.Kick}) AS kick,
                       SUM(action = ${PunishmentType.Ban})  AS ban
                FROM infractions
                WHERE (target_id = ${user.id} OR request_author_id = ${user.id})
                  AND guild_id = ${interaction.guildId!};

            `);

            if (dealtInfCount) {
                embed.addFields({
                    name: "Infractions Dealt",
                    value: mapInfractionCount(dealtInfCount),
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