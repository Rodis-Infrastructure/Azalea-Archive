import ChatInputCommand from "../../../handlers/interactions/commands/ChatInputCommand";

import {
    ChatInputCommandInteraction,
    ApplicationCommandType,
    Client,
    EmbedBuilder,
    ApplicationCommandOptionType
} from "discord.js";
import {InteractionResponseType} from "../../../utils/Types";
import {globalGuildConfigs} from "../../../Client";

export default class SampleCommand extends ChatInputCommand {
    constructor(client: Client) {
        super(client, {
            name: "config",
            description: "View guild configuration.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.EphemeralDefer,
            options: [{
                name: "guild_id",
                description: "The ID of the guild to view the configuration of",
                type: ApplicationCommandOptionType.String,
                required: false
            }]
        });
    }

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const guildId = interaction.options.getString("guild_id") ?? interaction.guildId as string;
        const config = globalGuildConfigs.get(guildId);

        const embed = new EmbedBuilder()
            .setColor(config?.colors?.default ?? "NotQuiteBlack")
            .setTitle("Guild Configuration")
            .setDescription(`\`\`\`json\n${JSON.stringify(config, null, 4)}\`\`\``)
            .setFooter({text: `Guild ID: ${guildId}`})
            .setAuthor({
                name: interaction.guild?.name as string,
                iconURL: interaction.guild?.iconURL() as string
            })

        await interaction.editReply({embeds: [embed]});
    }
}