import {ApplicationCommandType, MessageApplicationCommandData} from "discord.js";
import {ResponseType} from "../../../utils/Properties";
//import {RestrictionLevel} from "../../../utils/RestrictionUtils";

import CommandHandler from "./Manager";
import Bot from "../../../Bot";

type CustomApplicationCommandData = MessageApplicationCommandData & {
    //    restriction: RestrictionLevel;
    defer: ResponseType;
}

export default class MessageCommand {
    client: Bot;
    manager: CommandHandler;
    //    restriction: RestrictionLevel;
    defer: ResponseType;
    name: string;
    type: ApplicationCommandType.Message

    constructor(client: Bot, data: CustomApplicationCommandData) {
        this.client = client;
        this.manager = client.commands;
        //        this.restriction = data.restriction;
        this.defer = data.defer;
        this.name = data.name;
        this.type = data.type;

        try {
            // noinspection JSIgnoredPromiseFromCall
            this.client.commands.register(this);
        } catch (err) {
            console.error(err);
            return;
        }
    }

    build(): MessageApplicationCommandData {
        return {
            name: this.name,
            type: this.type
        };
    }
}