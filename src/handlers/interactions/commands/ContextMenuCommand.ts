import {ApplicationCommandType, UserApplicationCommandData, MessageApplicationCommandData} from "discord.js";
import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

import Bot from "../../../Bot";

type ContextMenuCommandData = MessageApplicationCommandData | UserApplicationCommandData;

type CustomApplicationCommandData = ContextMenuCommandData & {
    skipInternalUsageCheck?: boolean;
    restriction: RestrictionLevel;
    defer: ResponseType;
}

export default class ContextMenuCommand {
    type: ApplicationCommandType.User | ApplicationCommandType.Message;
    skipInternalUsageCheck?: boolean;
    restriction: RestrictionLevel;
    defer: ResponseType;
    name: string;
    client: Bot;

    constructor(client: Bot, data: CustomApplicationCommandData) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck ?? false;
        this.restriction = data.restriction;
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

    build(): ContextMenuCommandData {
        return {
            name: this.name,
            type: this.type
        };
    }
}