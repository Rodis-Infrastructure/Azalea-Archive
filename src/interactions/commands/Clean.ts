import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    GuildTextBasedChannel
} from "discord.js";

import { InteractionResponseType } from "../../utils/Types";
import { purgeMessages } from "../../utils/ModerationUtils";

import ChatInputCommand from "../../handlers/interactions/commands/ChatInputCommand";
import Config from "../../utils/Config";

export default class CleanCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "clean",
            description: "Purge messages in the channel.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Defer,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "all",
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
                    name: "user",
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

    async execute(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        const action = interaction.options.getSubcommand(true);
        const amount = interaction.options.getInteger("amount") ?? 100;
        const user = interaction.options.getUser("user");

        const { success, error } = config.emojis;

        try {
            const purgedMessages = await purgeMessages({
                channel: interaction.channel as GuildTextBasedChannel,
                amount,
                authorId: user?.id,
                moderatorId: interaction.user.id
            });

            if (!purgedMessages) {
                await interaction.editReply(`${error} There are no messages to purge.`);
                return;
            }

            let messageAuthor = "";
            if (action === "user") messageAuthor = ` by **${user!.tag}**`;

            await interaction.editReply(`${success} Successfully purged \`${purgedMessages}\` messages${messageAuthor}.`);
        } catch {
            await interaction.editReply(`${error} Failed to purge messages.`);
        }
    }
}