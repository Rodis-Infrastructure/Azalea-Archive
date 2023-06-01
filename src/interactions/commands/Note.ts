import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";
import { InfractionType, InteractionResponseType } from "../../utils/Types";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import Config from "../../utils/Config";
import { resolveInfraction, validateModerationAction } from "../../utils/ModerationUtils";

export default class KickCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "note",
            description: "Add a note to a member's infraction history.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
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

    async execute(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        const user = interaction.options.getUser("user", true);
        const member = interaction.options.getMember("user") as GuildMember;
        const note = interaction.options.getString("note", true);

        const { error, success } = config.emojis;

        if (member) {
            const notModerateableReason = validateModerationAction({
                config,
                moderatorId: interaction.user.id,
                offender: member
            });

            if (notModerateableReason) {
                await interaction.editReply(`${error} ${notModerateableReason}`);
                return;
            }
        }

        try {
            await resolveInfraction({
                moderator: interaction.user,
                offender: user,
                guildId: interaction.guildId!,
                reason: note,
                infractionType: InfractionType.Note
            });

            await interaction.editReply(`${success} Successfully added a note to **${user.tag}**${note ? ` (\`${note}\`)` : ""}`);
        } catch (err) {
            console.error(err);
            await interaction.editReply(`${error} An error occurred while adding the note.`);
        }
    }
}