import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildMember,
    GuildTextBasedChannel
} from "discord.js";

import { purgeMessages, validateModerationAction } from "../../utils/moderation";
import { InteractionResponseType, PurgeSubcommand } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { pluralize } from "../../utils";

import Config from "../../utils/config";

export default class CleanCommand extends Command {
    constructor() {
        super({
            name: "clean",
            description: "Purge messages in the channel.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: PurgeSubcommand.All,
                    description: "Purge all messages in the channel.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [{
                        name: "amount",
                        description: "The amount of messages to purge.",
                        type: ApplicationCommandOptionType.Integer,
                        max_value: 100,
                        min_value: 1,
                        required: true
                    }]
                },
                {
                    name: PurgeSubcommand.User,
                    description: "Purge messages from a user in the channel.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: "user",
                            description: "The amount of messages to purge.",
                            type: ApplicationCommandOptionType.User,
                            required: true
                        },
                        {
                            name: "amount",
                            description: "The amount of messages to purge.",
                            type: ApplicationCommandOptionType.Integer,
                            max_value: 100,
                            min_value: 1
                        }
                    ]
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const action = interaction.options.getSubcommand(true);
        const amount = interaction.options.getInteger("amount") ?? 100;
        const user = interaction.options.getUser("user");
        const member = interaction.options.getMember("user") as GuildMember;

        const { success, error } = config.emojis;

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
            const purgedMessages = await purgeMessages({
                channel: interaction.channel as GuildTextBasedChannel,
                amount,
                authorId: user?.id,
                moderatorId: interaction.user.id
            });

            if (!purgedMessages) {
                await interaction.reply({
                    content: `${error} There are no messages to purge.`,
                    ephemeral
                });
                return;
            }

            let messageAuthor = "";
            if (action === PurgeSubcommand.User) messageAuthor = ` by **${user!.tag}**`;

            await interaction.reply({
                content: `${success} Successfully purged \`${purgedMessages}\` ${pluralize("message", purgedMessages)}${messageAuthor}.`,
                ephemeral
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: `${error} Failed to purge messages.`,
                ephemeral
            });
        }
    }
}