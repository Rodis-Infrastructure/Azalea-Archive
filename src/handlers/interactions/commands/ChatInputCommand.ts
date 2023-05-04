import {
    ApplicationCommandOptionData,
    ApplicationCommandType,
    ChatInputApplicationCommandData,
    CommandInteraction,
    PermissionFlagsBits
} from "discord.js";

import { InteractionResponseType } from "../../../utils/Types";

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

    protected constructor(data: CustomApplicationCommandData) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck;
        this.description = data.description;
        this.options = data.options ?? [];
        this.defer = data.defer;
        this.name = data.name;
        this.type = data.type;
    }

    abstract execute(interaction: CommandInteraction): Promise<void>;

    build(): ChatInputApplicationCommandData {
        return {
            name: this.name,
            description: this.description,
            options: this.options,
            dmPermission: false,
            type: this.type,
            defaultMemberPermissions: [PermissionFlagsBits.Administrator]
        };
    }
}