import {
    ActionRow,
    ActionRowBuilder,
    blockQuote,
    ButtonBuilder,
    ButtonComponent,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
    Snowflake,
    StringSelectMenuInteraction,
    time
} from "discord.js";

import { InteractionResponseType } from "@bot/types/interactions";
import { Component } from "@bot/handlers/interactions/interaction";
import { RegexPatterns } from "@bot/utils";
import { TemporaryRole } from "@database/models/temporaryRole";
import { TimestampStyles } from "@discordjs/formatters";
import { setTemporaryRoleTimeout } from "@bot/utils/requests";
import { db } from "@database/utils.ts";

import Config from "@bot/utils/config";

/**
 * Select menu for approving role requests
 *
 * - The label of each option is the name of the role
 * - The value of each option is the ID of the role
 */
export default class ApproveRoleRequestSelectMenu extends Component<StringSelectMenuInteraction<"cached">> {
    constructor() {
        super({
            name: "role-request-role-add",
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: StringSelectMenuInteraction<"cached">, _ephemeral: never, config: Config): Promise<void> {
        const { emojis } = config;

        if (!interaction.channel) {
            await interaction.reply({
                content: `${emojis.error} Failed to fetch the channel.`,
                ephemeral: true
            });
            return;
        }

        // Check if the bot has permission to manage roles
        if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({
                content: `${emojis.error} I do not have permission to manage roles.`,
                ephemeral: true
            });
            return;
        }

        const [roleId] = interaction.values;
        const role = await interaction.guild.roles.fetch(roleId);

        if (!role) {
            await interaction.reply({
                content: `${emojis.error} Failed to fetch the role.`,
                ephemeral: true
            });
            return;
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const userIds: Snowflake[] = embed.data.fields![0].value.match(RegexPatterns.Snowflake.pattern) || [];
        const members = await interaction.guild.members.fetch({ user: userIds });

        const removeRolesBtn = new ButtonBuilder()
            .setCustomId("role-request-role-remove")
            .setLabel("Remove Roles")
            .setStyle(ButtonStyle.Danger);

        // Remove the select menu from the message
        const actionRowData = interaction.message.components.toSpliced(0, 1)[0] as ActionRow<ButtonComponent>;
        const actionRow = ActionRowBuilder.from<ButtonBuilder>(actionRowData).addComponents(removeRolesBtn);
        const duration = config.getTemporaryRoleDuration(roleId);

        let relativeTimestamp = "N/A";

        if (duration) {
            const existingTimeoutsForRole = await db.all<Pick<TemporaryRole, "request_id" | "users">>(`
                SELECT request_id, users
                FROM temporary_roles
                WHERE role_id = $roleId
                  AND guild_id = $guildId
            `, [{
                $roleId: roleId,
                $guildId: interaction.guildId
            }]);

            const timeoutsToUpdate = existingTimeoutsForRole.filter(timeout =>
                timeout.users
                    .split(",")
                    .some(userId => userIds.includes(userId))
            );

            // Remove the users from existing timeouts to prolong the amount of time they have the role
            for (const timeout of timeoutsToUpdate) {
                const updatedUserList = timeout.users
                    .split(",")
                    .filter(userId => !userIds.includes(userId))
                    .join(",");

                if (updatedUserList.length) {
                    await db.run(`
                        UPDATE temporary_roles
                        SET users = $users
                        WHERE request_id = $requestId
                    `, [{
                        $users: updatedUserList,
                        $requestId: timeout.request_id
                    }]);
                } else {
                    await db.run(`
                        DELETE
                        FROM temporary_roles
                        WHERE request_id = $requestId
                    `, [{
                        $requestId: timeout.request_id
                    }]);
                }
            }

            const msExpiresAt = Date.now() + duration;
            await db.run(`
                INSERT INTO temporary_roles (request_id, role_id, expires_at, guild_id, users)
                VALUES ($requestId, $roleId, $expiresAt, $guildId, $users)
            `, [{
                $requestId: interaction.message.id,
                $roleId: roleId,
                $expiresAt: msExpiresAt,
                $guildId: interaction.guildId,
                $users: userIds.join(",")
            }]);

            setTemporaryRoleTimeout({
                requestId: interaction.message.id,
                requestQueue: interaction.channel,
                expiresAt: msExpiresAt,
                guild: interaction.guild
            });

            relativeTimestamp = time(Math.floor(msExpiresAt / 1000), TimestampStyles.RelativeTime);
            embed.setTitle("Temporary Role");
        } else {
            embed.setTitle("Permanent Role");
        }

        await Promise.all(members.map(member => member.roles.add(role)));
        embed.setColor(role.color);

        // Prepend the overview field
        embed.spliceFields(0, 0, {
            name: "Overview",
            value: blockQuote(`\`Approved by\` ${interaction.user}\n\`Role\` ${role}\n\`Expires\` ${relativeTimestamp}`)
        });

        await interaction.update({
            embeds: [embed],
            components: [actionRow]
        });
    }
}