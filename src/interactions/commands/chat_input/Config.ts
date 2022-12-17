import ChatInputCommand from "../../../handlers/interactions/commands/ChatInputCommand";
import ClientManager from "../../../Client";

import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    ApplicationCommandType,
    EmbedBuilder,
} from "discord.js";

import {GuildConfig, InteractionResponseType} from "../../../utils/Types";
import {JsonMap, stringify} from "@iarna/toml";

export default class SampleCommand extends ChatInputCommand {
    constructor() {
        super({
            name: "config",
            description: "View guild configuration.",
            type: ApplicationCommandType.ChatInput,
            defer: InteractionResponseType.EphemeralDefer,
            skipInternalUsageCheck: false,
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
        const config = ClientManager.guildConfigs.get(guildId) as GuildConfig;

        const embed = new EmbedBuilder()
            .setColor(config?.colors?.embedDefault ?? "NotQuiteBlack")
            .setTitle("Guild Configuration")
            .setDescription(`\`\`\`toml\n${stringify(config as JsonMap)}\`\`\``)
            .setFooter({text: `Guild ID: ${guildId}`})
            .setAuthor({
                name: interaction.guild?.name as string,
                iconURL: interaction.guild?.iconURL() as string
            })

        await interaction.editReply({embeds: [embed]});
    }
}