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

import { InfractionCount, InfractionPunishment } from "../../types/db";
import { formatTimestamp, mapInfractionCount } from "../../utils";
import { InteractionResponseType } from "../../types/interactions";
import { getQuery } from "../../db";

import ChatInputCommand from "../../handlers/interactions/commands/chatInputCommand";
import ClientManager from "../../client";
import Config from "../../utils/config";

export default class InfoCommand extends ChatInputCommand {
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
                type: ApplicationCommandOptionType.User,
                required: true
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const user = interaction.options.getUser("user", true);
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
                    name: "Nickname",
                    value: member.displayName,
                    inline: true
                },
                {
                    name: "Created",
                    value: formatTimestamp(Math.floor(user.createdTimestamp / 1000), "R"),
                    inline: true
                },
                {
                    name: "Joined",
                    value: formatTimestamp(Math.floor(member.joinedTimestamp as number / 1000), "R"),
                    inline: true
                }
            ]);
        } else {
            embed.setColor(Colors.Red);
            embed.setFields({
                name: "Created",
                value: formatTimestamp(Math.floor(user.createdTimestamp / 1000), "R"),
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
                      AND action = ${InfractionPunishment.Ban}
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
            const infractions = ClientManager.cache.infractions.get(user.id)?.data;
            let infCount = {
                note: 0,
                mute: 0,
                kick: 0,
                ban: 0
            };

            if (infractions) {
                for (const infraction of infractions) {
                    switch (infraction.action) {
                        case InfractionPunishment.Note:
                            infCount.note++;
                            break;
                        case InfractionPunishment.Mute:
                            infCount.mute++;
                            break;
                        case InfractionPunishment.Kick:
                            infCount.kick++;
                            break;
                        case InfractionPunishment.Ban:
                            infCount.ban++;
                            break;
                    }
                }
            } else {
                const fetchedInfCount = await getQuery<InfractionCount>(`
                    SELECT SUM(action = ${InfractionPunishment.Note}) AS note,
                           SUM(action = ${InfractionPunishment.Mute}) AS mute,
                           SUM(action = ${InfractionPunishment.Kick}) AS kick,
                           SUM(action = ${InfractionPunishment.Ban})  AS ban
                    FROM infractions
                    WHERE target_id = ${user.id}
                      AND guild_id = ${interaction.guildId!};

                `);

                if (fetchedInfCount) infCount = fetchedInfCount;
            }

            embed.addFields({
                name: "Infractions",
                value: mapInfractionCount(infCount),
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
            config.actionAllowed(interaction.member as GuildMember, {
                permission: "viewModerationActivity",
                requiredValue: true
            })
        ) {
            ephemeral = true;
            const dealtInfCount = await getQuery<InfractionCount>(`
                SELECT SUM(action = ${InfractionPunishment.Note}) AS note,
                       SUM(action = ${InfractionPunishment.Mute}) AS mute,
                       SUM(action = ${InfractionPunishment.Kick}) AS kick,
                       SUM(action = ${InfractionPunishment.Ban})  AS ban
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