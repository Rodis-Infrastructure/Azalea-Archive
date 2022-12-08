import {Client} from "discord.js";

type CustomModalComponent = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; };
    skipInternalUsageCheck?: boolean;
    ephemeral: boolean;
}

export default class Modal {
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    skipInternalUsageCheck?: boolean;
    ephemeral: boolean;
    client: Client;

    constructor(client: Client, data: CustomModalComponent) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck ?? false;
        this.ephemeral = data.ephemeral;
        this.name = data.name;
        this.client = client;
    }
}