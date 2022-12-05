import {ApplicationCommandOptionData, ApplicationCommandType, ChatInputApplicationCommandData} from "discord.js";
import {ResponseType} from "../../../utils/Properties";
//import {RestrictionLevel} from "../../../utils/RestrictionUtils";

import CommandHandler from "./Manager";
import Bot from "../../../Bot";

type CustomApplicationCommandData = ChatInputApplicationCommandData & {
//    restriction: RestrictionLevel;
    type: ApplicationCommandType;
    defer: ResponseType;
}

export default class ChatInputCommand {
    client: Bot;
    manager: CommandHandler;
//    restriction: RestrictionLevel;
    defer: ResponseType;
    name: string;
    description: string;
    options?: ApplicationCommandOptionData[];
    type: ApplicationCommandType.ChatInput;

    constructor(client: Bot, data: CustomApplicationCommandData) {
        this.client = client;
        this.manager = client.commands;
//        this.restriction = data.restriction;
        this.defer = data.defer;
        this.name = data.name;
        this.description = data.description;
        this.type = data.type;
        this.options = data.options ?? [];

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