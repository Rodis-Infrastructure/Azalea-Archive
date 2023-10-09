import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { resolveInfraction } from "../../utils/moderation";
import { PunishmentType } from "../../types/db";
import { formatReason } from "../../utils";

import Config from "../../utils/config";

export default class UnbanCommand extends Command {
    constructor() {
        super({
            name: "unban",
            description: "Unbans a banned user.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "user",
                    description: "The user to unban",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "reason",
                    description: "The reason for unbanning the user",
                    type: ApplicationCommandOptionType.String,
                    max_length: 1024
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const target = interaction.options.getUser("user", true);
        const targetIsBanned = await interaction.guild!.bans.fetch(target.id)
            .then(() => true)
            .catch(() => false);

        const { success, error } = config.emojis;

        if (!targetIsBanned) {
            await interaction.reply({
                content: `${error} This user is not banned.`,
                ephemeral
            });
            return;
        }

        const reason = interaction.options.getString("reason") ?? undefined;

        try {
            await interaction.guild!.members.unban(target, reason);
            await resolveInfraction({
                punishment: PunishmentType.Unban,
                executorId: interaction.user.id,
                targetId: target.id,
                guildId: interaction.guildId!,
                reason
            });
        } catch (_err) {
            const err = _err as Error;

            await interaction.reply({
                content: `${error} An error has occurred while trying to execute this interaction: ${err.message}`,
                ephemeral
            });

            return;
        }

        const confirmation = config.formatConfirmation(`unbanned ${target}`, {
            executorId: interaction.user.id,
            success: true,
            reason
        });

        await Promise.all([
            interaction.reply({
                content: `${success} Successfully unbanned ${target}${formatReason(reason)}`,
                ephemeral
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: interaction.channelId
            })
        ]);
    }
}