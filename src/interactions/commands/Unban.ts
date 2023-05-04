import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";

import ClientManager from "../../Client";
import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import { resolveInfraction } from "../../utils/ModerationUtils";
import { InfractionType, InteractionResponseType } from "../../utils/Types";

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
                    max_length: 1024,
                    required: false
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const reason = interaction.options.getString("reason");
        const user = interaction.options.getUser("user")!;
        const guildId = interaction.guildId!;
        const config = ClientManager.config(guildId)!;

        const { success, error } = config.emojis;
        const bannedMember = await interaction.guild?.bans.fetch(user.id)
            .catch(() => undefined);

        if (!bannedMember) {
            await interaction.editReply(`${error} This user is not banned.`);
            return;
        }

        try {
            await interaction.guild?.members.unban(user, reason ?? undefined);
            await Promise.all([
                resolveInfraction({
                    infractionType: InfractionType.Unban,
                    moderator: interaction.user,
                    offender: user,
                    guildId,
                    reason
                }),

                interaction.editReply(`${success} Successfully unbanned **${user.tag}**${reason ? ` (\`${reason}\`)` : ""}`)
            ]);
        } catch {
            await interaction.editReply(`${error} An error has occurred while trying to unban this user.`);
        }
    }
}