import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChatInputCommandInteraction,
    EmbedBuilder
} from "discord.js";

import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";

import Config from "@bot/utils/config";

export default class FaqCommand extends Command {
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

    async execute(interaction: ChatInputCommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> {
        const choice = interaction.options.getString("query", true);
        const mention = interaction.options.getUser("mention");
        const response = config.getCustomCommandResponse(choice);

        if (!response) {
            await interaction.reply({
                content: "Unknown query.",
                ephemeral
            });
            return;
        }

        const footer = response.footer?.text
            ? ` - ${response.footer.text}`
            : "";

        const embed = new EmbedBuilder(response)
            .setFooter({
                text: `Posted by ${interaction.member.displayName}${footer}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({
            content: mention ? `${mention}` : undefined,
            embeds: [embed]
        });
    }
}