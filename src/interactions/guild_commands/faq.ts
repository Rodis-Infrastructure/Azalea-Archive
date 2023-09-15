import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../types/interactions";

import ChatInputCommand from "../../handlers/interactions/commands/chatInputCommand";
import Config from "../../utils/config";

export default class FaqCommand extends ChatInputCommand {
    constructor(config: Config) {
        super({
            name: "faq",
            description: "Send a quick response to a common question.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false,
            options: [
                {
                    name: "query",
                    description: "The response to send.",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: config.customCommandChoices
                },
                {
                    name: "mention",
                    description: "The user to mention in the response.",
                    type: ApplicationCommandOptionType.User
                }
            ]
        });
    }

    async execute(interaction: ChatInputCommandInteraction, ephemeral: boolean, config: Config): Promise<void> {
        const choice = interaction.options.getString("query", true);
        const mention = interaction.options.getUser("mention");
        const response = config.customCommandResponses.get(choice);

        if (!response) {
            await interaction.reply({
                content: "Unknown query.",
                ephemeral
            });
            return;
        }

        await interaction.reply({
            content: mention ? `${mention}` : undefined,
            embeds: [response]
        });
    }
}