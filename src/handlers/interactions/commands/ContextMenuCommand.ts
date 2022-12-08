import {ApplicationCommandType, UserApplicationCommandData, MessageApplicationCommandData, Client} from "discord.js";
import {InteractionResponseType} from "../../../utils/Types";

type ContextMenuCommandData = MessageApplicationCommandData | UserApplicationCommandData;

type CustomApplicationCommandData = ContextMenuCommandData & {
    skipInternalUsageCheck?: boolean;
    defer: InteractionResponseType;
}

export default class ContextMenuCommand {
    type: ApplicationCommandType.User | ApplicationCommandType.Message;
    skipInternalUsageCheck?: boolean;
    defer: InteractionResponseType;
    client: Client;
    name: string;

    constructor(client: Client, data: CustomApplicationCommandData) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck ?? false;
        this.defer = data.defer;
        this.name = data.name;
        this.type = data.type;
        this.client = client;
    }

    build(): ContextMenuCommandData {
        return {
            name: this.name,
            dmPermission: false,
            type: this.type,
        };
    }
}