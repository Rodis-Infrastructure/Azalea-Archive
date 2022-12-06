import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";

import Bot from "../../../Bot";

type CustomSelectMenuComponent = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; };
    skipInternalUsageCheck?: boolean;
    restriction: RestrictionLevel;
    defer: ResponseType;
}

export default class SelectMenu {
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    skipInternalUsageCheck?: boolean;
    restriction: RestrictionLevel;
    defer: ResponseType;
    client: Bot;

    constructor(client: Bot, data: CustomSelectMenuComponent) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck ?? false;
        this.restriction = data.restriction;
        this.defer = data.defer;
        this.name = data.name;
        this.client = client;

        try {
            // noinspection JSIgnoredPromiseFromCall
            this.client.select_menus.register(this);
        } catch (err) {
            console.error(err);
            return;
        }
    }
}