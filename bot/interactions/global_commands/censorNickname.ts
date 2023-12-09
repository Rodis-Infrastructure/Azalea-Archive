import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    Colors,
    EmbedBuilder,
    PermissionFlagsBits,
    roleMention
} from "discord.js";

import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { LoggingEvent } from "@bot/types/config";
import { sendLog } from "@bot/utils/logging";

import Config from "@bot/utils/config";

// Constants
const PENCIL_ICON_NAME = "pencil.png";
const PENCIL_ICON_PATH = `./icons/${PENCIL_ICON_NAME}`;

export default class CensorNicknameCommand extends Command {
    constructor() {
        super({
            name: "censor-nickname",
            description: "Set a user's nickname to their ID.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [{
                name: "user",
                description: "The user to add a note to",
                type: ApplicationCommandOptionType.User,
                required: true
            }]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const target = interaction.options.getMember("user");

        if (!target) {
            await interaction.reply({
                content: "Failed to find the user.",
                ephemeral
            });
            return;
        }

        if (target.nickname === target.id) {
            await interaction.reply({
                content: "This user's nickname is already censored.",
                ephemeral
            });
            return;
        }

        if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            await interaction.reply({
                content: "I do not have permission to change nicknames.",
                ephemeral
            });
            return;
        }

        if (!target.manageable) {
            await interaction.reply({
                content: "I do not have permission to censor this user's nickname.",
                ephemeral
            });
            return;
        }

        const targetHasAllowedRole = !config.nicknameCensorship.allowedRoles.length
            || target.roles.cache.some(role => config.nicknameCensorship.allowedRoles.includes(role.id));

        if (!targetHasAllowedRole) {
            const roleMentions = config.nicknameCensorship.allowedRoles
                .map(role => roleMention(role))
                .join(" ");

            await interaction.reply({
                content: `Only users with the following role(s) can have their nickname censored: ${roleMentions}`,
                allowedMentions: { roles: [] },
                ephemeral
            });

            return;
        }

        const excludedRoles = target.roles.cache
            .filter(role => config.nicknameCensorship.excludedRoles.includes(role.id))
            .map(role => roleMention(role.id));

        if (excludedRoles.length) {
            await interaction.reply({
                content: `This user's nickname cannot be censored due to the following role(s): ${excludedRoles.join(" ")}`,
                allowedMentions: { roles: [] },
                ephemeral
            });
            return;
        }

        const oldDisplayName = target.displayName;
        await target.setNickname(target.id, `Nickname censored by ${interaction.user.tag} (${interaction.user.id})`);

        // Try to DM the user to let them know their nickname was censored.
        if (config.nicknameCensorship.embed) {
            await target.send({ embeds: [config.nicknameCensorship.embed] })
                .catch(() => null);
        }

        const log = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({
                name: "Member Nickname Censored",
                iconURL: `attachment://${PENCIL_ICON_NAME}`
            })
            .setFields([
                {
                    name: "Member",
                    value: `${target}`
                },
                {
                    name: "Moderator",
                    value: `${interaction.user}`
                },
                {
                    name: "Before",
                    value: `${oldDisplayName}`
                },
                {
                    name: "After",
                    value: `${target.id}`
                }
            ])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.Infraction,
            guildId: interaction.guildId,
            options: {
                embeds: [log],
                files: [{
                    attachment: PENCIL_ICON_PATH,
                    name: PENCIL_ICON_NAME
                }]
            }
        });

        await interaction.reply({
            content: `Successfully changed ${target}'s nickname to \`${target.id}\``,
            ephemeral
        });
    }
}