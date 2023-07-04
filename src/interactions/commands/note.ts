import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember
} from "discord.js";

import { resolveInfraction, validateModerationAction } from "../../utils/moderationUtils";
import { InteractionResponseType } from "../interaction.types";
import { InfractionType } from "../../utils/utils.types";
import { formatReason } from "../../utils";

import ChatInputCommand from "../../handlers/interactions/commands/chatInputCommand";
import Config from "../../utils/config";

export default class NoteCommand extends ChatInputCommand {
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

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
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
                await interaction.reply({
                    content: `${error} ${notModerateableReason}`,
                    ephemeral
                });
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
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: `${error} An error occurred while trying to execute this interaction`,
                ephemeral
            });
            return;
        }

        await Promise.all([
            interaction.reply({
                content: `${success} Successfully added a note to **${user.tag}**${formatReason(note)}`,
                ephemeral
            }),
            config.sendConfirmation({
                guild: interaction.guild!,
                authorId: interaction.user.id,
                message: `added a note to **${user.tag}**`,
                channelId: interaction.channelId,
                reason: note
            })
        ]);
    }
}