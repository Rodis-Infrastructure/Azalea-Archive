import {
    ChatInputApplicationCommandData,
    ApplicationCommandOptionData,
    ApplicationCommandType,
    CommandInteraction
} from "discord.js";

import {InteractionResponseType} from "../../../utils/Types";

type CustomApplicationCommandData = ChatInputApplicationCommandData & {
    skipInternalUsageCheck: boolean;
    type: ApplicationCommandType;
    defer: InteractionResponseType;
}

export default abstract class ChatInputCommand {
    options: ApplicationCommandOptionData[];
    type: ApplicationCommandType.ChatInput;
    skipInternalUsageCheck?: boolean;
    defer: InteractionResponseType;
    description: string;
    name: string;

    abstract execute(interaction: CommandInteraction): Promise<void>;

    protected constructor(data: CustomApplicationCommandData) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck;
        this.description = data.description;
        this.options = data.options ?? [];
        this.defer = data.defer;
        this.name = data.name;
        this.type = data.type;
    }

    build(): ChatInputApplicationCommandData {
        return {
            name: this.name,
            description: this.description,
            options: this.options,
            dmPermission: false,
            type: this.type
        };
    }
}