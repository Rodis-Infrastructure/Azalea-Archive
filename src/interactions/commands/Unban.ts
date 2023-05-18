import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { resolveInfraction } from "../../utils/ModerationUtils";
import { InfractionType, InteractionResponseType } from "../../utils/Types";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import Config from "../../utils/Config";

export default class UnbanCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "unban",
            description: "Unbans a banned user.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
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

    async execute(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        const offender = interaction.options.getUser("user", true);
        const banInfo = await interaction.guild!.bans.fetch(offender.id)
            .catch(() => null);

        const { success, error } = config.emojis;

        if (!banInfo) {
            await interaction.editReply(`${error} This user is not banned.`);
            return;
        }

        try {
            const reason = interaction.options.getString("reason") ?? undefined;

            await interaction.guild!.members.unban(offender, reason);
            await Promise.all([
                resolveInfraction({
                    infractionType: InfractionType.Unban,
                    moderator: interaction.user,
                    offender,
                    guildId: interaction.guildId!,
                    reason
                }),

                interaction.editReply(`${success} Successfully unbanned **${offender.tag}**${reason ? ` (\`${reason}\`)` : ""}`)
            ]);
        } catch {
            await interaction.editReply(`${error} An error has occurred while trying to unban this user.`);
        }
    }
}