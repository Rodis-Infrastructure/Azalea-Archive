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

import { InteractionResponseType, TInfraction } from "../../utils/Types";
import { formatTimestamp, pluralize } from "../../utils";
import { getQuery } from "../../db";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import ClientManager from "../../Client";
import Config from "../../utils/Config";

export default class InfoCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "info",
            description: "Get information about a user.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false,
            options: [{
                name: "user",
                description: "The user to get information about.",
                type: ApplicationCommandOptionType.User,
                required: true
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        const user = interaction.options.getUser("user", true);
        const member = interaction.options.getMember("user") as GuildMember;
        const components = [];
        const flags = [];

        if (user.bot) flags.push("Bot");

        const embed = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({
                name: user.tag,
                iconURL: user.displayAvatarURL(),
                url: user.displayAvatarURL()
            })
            .setFields([{
                name: "Created",
                value: formatTimestamp(Math.floor(user.createdTimestamp / 1000), "R"),
                inline: true
            }])
            .setFooter({ text: `ID: ${user.id}` });

        if (member) {
            if (config.isGuildStaff(member)) flags.push("Staff");

            embed.addFields([
                {
                    name: "Joined",
                    value: formatTimestamp(Math.floor(member.joinedTimestamp as number / 1000), "R"),
                    inline: true
                },
                {
                    name: "Nickname",
                    value: member.displayName,
                    inline: true
                }
            ]);
        } else {
            embed.setColor(Colors.Red);
            const ban = await interaction.guild!.bans.fetch(user.id)
                .then(() => true)
                .catch(() => false);

            if (ban) {
                const banData = await getQuery<{ reason: string }>(`
					SELECT reason
					FROM infractions
					WHERE targetId = ${user.id}
					  AND guildId = ${interaction.guildId!}
					  AND type = ${TInfraction.Ban}
					ORDER BY id DESC
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
                notes: 0,
                mutes: 0,
                kicks: 0,
                bans: 0
            };

            if (infractions) {
                for (const infraction of infractions) {
                    switch (infraction.type) {
                        case TInfraction.Note:
                            infCount.notes++;
                            break;
                        case TInfraction.Mute:
                            infCount.mutes++;
                            break;
                        case TInfraction.Kick:
                            infCount.kicks++;
                            break;
                        case TInfraction.Ban:
                            infCount.bans++;
                            break;
                        default:
                            break;
                    }
                }
            } else {
                const fetchedInfCount = await getQuery<typeof infCount>(`
					SELECT (SELECT COUNT(*) FROM infractions WHERE type = ${TInfraction.Note}) AS notes,
						   (SELECT COUNT(*) FROM infractions WHERE type = ${TInfraction.Mute}) AS mutes,
						   (SELECT COUNT(*) FROM infractions WHERE type = ${TInfraction.Kick}) AS kicks,
						   (SELECT COUNT(*) FROM infractions WHERE type = ${TInfraction.Ban})  AS bans
					FROM infractions
					WHERE targetId = ${user.id}
					  AND guildId = ${interaction.guildId!};
                `);

                if (fetchedInfCount) infCount = fetchedInfCount;
            }

            embed.addFields({
                name: "Infractions",
                value: `\`${infCount.notes}\` ${pluralize("Note", infCount.notes)}\n`
                    + `\`${infCount.mutes}\` ${pluralize("Mute", infCount.mutes)}\n`
                    + `\`${infCount.kicks}\` ${pluralize("Kick", infCount.kicks)}\n`
                    + `\`${infCount.bans}\` ${pluralize("Ban", infCount.bans)}`,
                inline: flags.length > 0
            });

            const infractionsBtn = new ButtonBuilder()
                .setLabel("Infractions")
                .setCustomId(`inf-search-${user.id}`)
                .setStyle(ButtonStyle.Secondary);

            const actionRow = new ActionRowBuilder<ButtonBuilder>().setComponents(infractionsBtn);
            components.push(actionRow);
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

        await interaction.editReply({
            embeds: [embed],
            components
        });
    }
}