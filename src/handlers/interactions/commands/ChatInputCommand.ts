import {ApplicationCommandOptionData, ApplicationCommandType, ChatInputApplicationCommandData, Client} from "discord.js";
import {InteractionResponseType} from "../../../utils/Types";

type CustomApplicationCommandData = ChatInputApplicationCommandData & {
    skipInternalUsageCheck?: boolean;
    type: ApplicationCommandType;
    defer: InteractionResponseType;
}

export default class ChatInputCommand {
    options?: ApplicationCommandOptionData[];
    type: ApplicationCommandType.ChatInput;
    skipInternalUsageCheck?: boolean;
    defer: InteractionResponseType;
    description: string;
    client: Client;
    name: string;

    constructor(client: Client, data: CustomApplicationCommandData) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck ?? false;
        this.description = data.description;
        this.options = data.options ?? [];
        this.defer = data.defer;
        this.name = data.name;
        this.type = data.type;
        this.client = client;
    }

    build(): ChatInputApplicationCommandData {
        return {
            name: this.name,
            description: this.description,
            options: this.options ?? [],
            dmPermission: false,
            type: this.type
        };
    }
}