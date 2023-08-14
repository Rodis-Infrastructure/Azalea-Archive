import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../types/interactions";
import { resolveInfraction } from "../../utils/moderation";
import { InfractionPunishment } from "../../types/db";
import { formatReason } from "../../utils";

import ChatInputCommand from "../../handlers/interactions/commands/chatInputCommand";
import Config from "../../utils/config";

export default class UnbanCommand extends ChatInputCommand {
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
        const offender = interaction.options.getUser("user", true);
        const banInfo = await interaction.guild!.bans.fetch(offender.id)
            .catch(() => null);

        const { success, error } = config.emojis;

        if (!banInfo) {
            await interaction.reply({
                content: `${error} This user is not banned.`,
                ephemeral
            });
            return;
        }

        const reason = interaction.options.getString("reason") ?? undefined;

        try {
            await interaction.guild!.members.unban(offender, reason);
            await resolveInfraction({
                punishment: InfractionPunishment.Unban,
                executor: interaction.user,
                target: offender,
                guildId: interaction.guildId!,
                reason
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: `${error} An error has occurred while trying to execute this interaction`,
                ephemeral
            });
            return;
        }

        await Promise.all([
            interaction.reply({
                content: `${success} Successfully unbanned **${offender.tag}**${formatReason(reason)}`,
                ephemeral
            }),
            config.sendConfirmation({
                guild: interaction.guild!,
                message: `unbanned **${offender.tag}**`,
                authorId: interaction.user.id,
                channelId: interaction.channelId,
                reason
            })
        ]);
    }
}