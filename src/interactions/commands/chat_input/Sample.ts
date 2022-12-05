import ChatInputCommand from "../../../handlers/interactions/commands/ChatInputCommand";
import Bot from "../../../Bot";

import {
    ChatInputCommandInteraction,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder
} from "discord.js";
//import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

export default class SampleCommand extends ChatInputCommand {
    constructor(client: Bot) {
        super(client, {
            name: "sample-command",
            description: "This is a sample application command.",
//            restriction: RestrictionLevel.Public,
            type: ApplicationCommandType.ChatInput,
            defer: ResponseType.EphemeralDefer
        });
    }

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const button = new ButtonBuilder()
            .setCustomId("sample-button")
            .setLabel("Sample")
            .setStyle(ButtonStyle.Primary)

        const actionRow = new ActionRowBuilder().setComponents(button) as ActionRowBuilder<ButtonBuilder>;

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("sample-select-menu")
            .setOptions({
                label: "sample",
                description: "sample description",
                value: "sample"
            });

        const actionRow2 = new ActionRowBuilder().setComponents(selectMenu) as ActionRowBuilder<StringSelectMenuBuilder>;

        await interaction.editReply({
            content: "This is a sample **CHAT_INPUT** command.",
            components: [actionRow, actionRow2]
        });
        return;
    }
}