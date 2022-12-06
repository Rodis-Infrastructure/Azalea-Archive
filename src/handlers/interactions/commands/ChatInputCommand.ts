import {ApplicationCommandOptionData, ApplicationCommandType, ChatInputApplicationCommandData} from "discord.js";
import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

import Bot from "../../../Bot";

type CustomApplicationCommandData = ChatInputApplicationCommandData & {
    skipInternalUsageCheck?: boolean;
    restriction: RestrictionLevel;
    type: ApplicationCommandType;
    defer: ResponseType;
}

export default class ChatInputCommand {
    options?: ApplicationCommandOptionData[];
    type: ApplicationCommandType.ChatInput;
    skipInternalUsageCheck?: boolean;
    restriction: RestrictionLevel;
    defer: ResponseType;
    description: string;
    name: string;
    client: Bot;

    constructor(client: Bot, data: CustomApplicationCommandData) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck ?? false;
        this.restriction = data.restriction;
        this.description = data.description;
        this.options = data.options ?? [];
        this.defer = data.defer;
        this.name = data.name;
        this.type = data.type;
        this.client = client;

        try {
            // noinspection JSIgnoredPromiseFromCall
            this.client.commands.register(this);
        } catch (err) {
            console.error(err);
            return;
        }
    }

    build(): ChatInputApplicationCommandData {
        return {
            name: this.name,
            description: this.description,
            options: this.options ?? [],
            type: this.type
        };
    }
}