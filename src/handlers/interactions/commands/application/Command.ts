import {ApplicationCommandOptionData, ChatInputApplicationCommandData} from "discord.js";
//import {RestrictionLevel} from "../../../utils/RestrictionUtils";

import CommandHandler from "./Manager";
import Bot from "../../../../Bot";

export enum ResponseType {
    Defer = 0,
    EphemeralDefer = 1,
    Modal = 2
}

type CustomApplicationCommandData = ChatInputApplicationCommandData & {
//    restriction: RestrictionLevel;
    defer: ResponseType;
}

export default class Command {
    client: Bot;
    manager: CommandHandler;
//    restriction: RestrictionLevel;
    defer: ResponseType;
    name: string;
    description: string;
    options?: ApplicationCommandOptionData[];

    constructor(client: Bot, data: CustomApplicationCommandData) {
        this.client = client;
        this.manager = client.application_commands;
//        this.restriction = data.restriction;
        this.defer = data.defer;
        this.name = data.name;
        this.description = data.description;
        this.options = data.options ?? [];

        try {
            // noinspection JSIgnoredPromiseFromCall
            this.client.application_commands.register(this);
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
        };
    }
}