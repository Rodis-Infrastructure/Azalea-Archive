import {InteractionResponseType} from "../../../utils/Types";
import {Client} from "discord.js";

type CustomSelectMenuComponent = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; };
    skipInternalUsageCheck?: boolean;
    defer: InteractionResponseType;
}

export default class SelectMenu {
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    skipInternalUsageCheck?: boolean;
    defer: InteractionResponseType;
    client: Client;

    constructor(client: Client, data: CustomSelectMenuComponent) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck ?? false;
        this.defer = data.defer;
        this.name = data.name;
        this.client = client;
    }
}