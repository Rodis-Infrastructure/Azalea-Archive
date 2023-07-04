import {
    ApplicationCommandType,
    ChatInputApplicationCommandData,
    CommandInteraction,
    PermissionFlagsBits
} from "discord.js";

import { InteractionResponseType } from "../../../interactions/interaction.types";
import Config from "../../../utils/config";

type CustomChatInputCommandProperties = ChatInputApplicationCommandData & {
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    ephemeral?: boolean;
}

export default abstract class ChatInputCommand {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomChatInputCommandProperties) {}
    abstract execute(interaction: CommandInteraction, ephemeral: boolean, config: Config): Promise<void>;

    build(): ChatInputApplicationCommandData {
        return {
            name: this.data.name,
            description: this.data.description,
            options: this.data.options ?? [],
            dmPermission: false,
            type: ApplicationCommandType.ChatInput,
            defaultMemberPermissions: [PermissionFlagsBits.ManageChannels]
        };
    }
}