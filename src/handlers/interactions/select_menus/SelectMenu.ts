//import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";
import Bot from "../../../Bot";

type CustomSelectMenuComponent = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; };
//    restriction: RestrictionLevel;
    defer: ResponseType;
}

export default class SelectMenu {
    client: Bot;
//    restriction: RestrictionLevel;
    defer: ResponseType;
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };

    constructor(client: Bot, data: CustomSelectMenuComponent) {
        this.client = client;
//        this.restriction = data.restriction;
        this.defer = data.defer;
        this.name = data.name;

        try {
            // noinspection JSIgnoredPromiseFromCall
            this.client.select_menus.register(this);
        } catch (err) {
            console.error(err);
            return;
        }
    }
}