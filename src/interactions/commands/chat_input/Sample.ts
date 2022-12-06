import ChatInputCommand from "../../../handlers/interactions/commands/ChatInputCommand";
import Bot from "../../../Bot";

import {
    ChatInputCommandInteraction,
    ApplicationCommandType,
    ButtonStyle,
    TextInputStyle
} from "discord.js";

import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

export default class SampleCommand extends ChatInputCommand {
    constructor(client: Bot) {
        super(client, {
            name: "sample-command",
            description: "This is a sample application command.",
            restriction: RestrictionLevel.Everyone,
            type: ApplicationCommandType.ChatInput,
            defer: ResponseType.EphemeralDefer
        });
    }

    /**
     * @param {ChatInputCommandInteraction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.editReply("This is a sample **CHAT_INPUT** command.");
    }
}