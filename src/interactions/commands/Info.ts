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

import { InfractionAction, InfractionCount, InteractionResponseType } from "../../utils/Types";
import { formatTimestamp, mapInfractionCount } from "../../utils";
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
                type: ApplicationCommandOptionType.User
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
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
            .setFields([{
                name: "Created",
                value: formatTimestamp(Math.floor(user.createdTimestamp / 1000), "R"),
                inline: true
            }])
            .setFooter({ text: `ID: ${user.id}` });

        if (member) {
            flags.push(...config.userFlags(member));
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
					  AND action = ${InfractionAction.Ban}
					ORDER BY infractionId DESC
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
                        case InfractionAction.Note:
                            infCount.note++;
                            break;
                        case InfractionAction.Mute:
                            infCount.mute++;
                            break;
                        case InfractionAction.Kick:
                            infCount.kick++;
                            break;
                        case InfractionAction.Ban:
                            infCount.ban++;
                            break;
                    }
                }
            } else {
                const fetchedInfCount = await getQuery<InfractionCount>(`
					SELECT (SELECT COUNT(*) FROM infractions WHERE action = ${InfractionAction.Note}) AS notes,
						   (SELECT COUNT(*) FROM infractions WHERE action = ${InfractionAction.Mute}) AS mutes,
						   (SELECT COUNT(*) FROM infractions WHERE action = ${InfractionAction.Kick}) AS kicks,
						   (SELECT COUNT(*) FROM infractions WHERE action = ${InfractionAction.Ban})  AS bans
					FROM infractions
					WHERE targetId = ${user.id}
					  AND guildId = ${interaction.guildId!};
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
            const dealtInfCount = await getQuery<InfractionCount>(`
				SELECT (SELECT COUNT(*) FROM infractions WHERE action = ${InfractionAction.Note}) AS note,
					   (SELECT COUNT(*) FROM infractions WHERE action = ${InfractionAction.Mute}) AS mute,
					   (SELECT COUNT(*) FROM infractions WHERE action = ${InfractionAction.Kick}) AS kick,
					   (SELECT COUNT(*) FROM infractions WHERE action = ${InfractionAction.Ban})  AS ban
				FROM infractions
				WHERE (executorId = ${user.id} OR requestAuthorId = ${user.id})
				  AND guildId = ${interaction.guildId!};
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

        await interaction.editReply({
            embeds: [embed],
            components
        });
    }
}