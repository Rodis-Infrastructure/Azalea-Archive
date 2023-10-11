import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction, validateModerationAction } from "../../utils/moderation";
import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { PunishmentType } from "../../types/db";
import { formatReason } from "../../utils";

import Config from "../../utils/config";

export default class NoteCommand extends Command {
    constructor() {
        super({
            name: "note",
            description: "Add a note to a member's infraction history.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "user",
                    description: "The user to add a note to",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "note",
                    description: "The note to add",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    max_length: 1024
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const targetMember = interaction.options.getMember("user");
        const targetUser = interaction.options.getUser("user", true);
        const note = interaction.options.getString("note", true);

        const { error, success } = config.emojis;

        if (targetMember) {
            const notModerateableReason = validateModerationAction({
                executorId: interaction.user.id,
                target: targetMember,
                config
            });

            if (notModerateableReason) {
                await interaction.reply({
                    content: `${error} ${notModerateableReason}`,
                    ephemeral
                });
                return;
            }
        }

        try {
            await resolveInfraction({
                executorId: interaction.user.id,
                targetId: targetUser.id,
                guildId: interaction.guildId,
                reason: note,
                punishment: PunishmentType.Note
            });
        } catch (_err) {
            const err = _err as Error;

            await interaction.reply({
                content: `${error} An error occurred while trying to execute this interaction: ${err.message}`,
                ephemeral
            });

            return;
        }

        const confirmation = config.formatConfirmation(`added a note to ${targetUser}`, {
            executorId: interaction.user.id,
            success: true,
            reason: note
        });

        await Promise.all([
            interaction.reply({
                content: `${success} Successfully added a note to ${targetUser}${formatReason(note)}`,
                ephemeral
            }),
            config.sendNotification(confirmation, {
                sourceChannelId: interaction.channelId
            })
        ]);
    }
}