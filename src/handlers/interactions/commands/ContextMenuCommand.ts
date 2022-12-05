import {ApplicationCommandType, UserApplicationCommandData, MessageApplicationCommandData} from "discord.js";
import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

import CommandHandler from "./Manager";
import Bot from "../../../Bot";

type ContextMenuCommandData = MessageApplicationCommandData | UserApplicationCommandData;

type CustomApplicationCommandData = ContextMenuCommandData & {
    restriction: RestrictionLevel;
    defer: ResponseType;
}

export default class ContextMenuCommand {
    client: Bot;
    manager: CommandHandler;
    restriction: RestrictionLevel;
    defer: ResponseType;
    name: string;
    type: ApplicationCommandType.User | ApplicationCommandType.Message;

    constructor(client: Bot, data: CustomApplicationCommandData) {
        this.client = client;
        this.manager = client.commands;
        this.restriction = data.restriction;
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

    build(): ContextMenuCommandData {
        return {
            name: this.name,
            type: this.type
        };
    }
}