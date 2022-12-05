import ModalHandler from "./Manager";
import Bot from "../../../Bot";

//import {RestrictionLevel} from "../../../utils/RestrictionUtils";

type CustomModalComponent = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; }
//    restriction: RestrictionLevel;
    ephemeral: boolean;
}

export default class Modal {
    client: Bot;
    manager: ModalHandler;
//    restriction: RestrictionLevel;
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    ephemeral: boolean;

    constructor(client: Bot, data: CustomModalComponent) {
        this.client = client;
        this.manager = client.modals;
//        this.restriction = data.restriction;
        this.name = data.name;
        this.ephemeral = data.ephemeral

        try {
            // noinspection JSIgnoredPromiseFromCall
            this.client.modals.register(this);
        } catch (err) {
            console.error(err);
            return;
        }
    }
}