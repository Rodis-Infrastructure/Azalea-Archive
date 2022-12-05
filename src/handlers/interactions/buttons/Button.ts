import {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";
import Bot from "../../../Bot";

type CustomButtonComponentData = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; }
    restriction: RestrictionLevel;
    defer: ResponseType;
}

export default class Button {
    client: Bot;
    restriction: RestrictionLevel;
    defer: ResponseType;
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };

    constructor(client: Bot, data: CustomButtonComponentData) {
        this.client = client;
        this.restriction = data.restriction;
        this.defer = data.defer;
        this.name = data.name;

        try {
            // noinspection JSIgnoredPromiseFromCall
            this.client.buttons.register(this);
        } catch (err) {
            console.error(err);
            return;
        }
    }
}