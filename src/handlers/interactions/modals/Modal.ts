import ModalHandler from "./Manager";
import Bot from "../../../Bot";

import {RestrictionLevel} from "../../../utils/RestrictionUtils";

type CustomModalComponent = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; };
    skipInternalUsageCheck?: boolean;
    restriction: RestrictionLevel;
    ephemeral: boolean;
}

export default class Modal {
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    skipInternalUsageCheck?: boolean;
    restriction: RestrictionLevel;
    manager: ModalHandler;
    ephemeral: boolean;
    client: Bot;

    constructor(client: Bot, data: CustomModalComponent) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck ?? false;
        this.restriction = data.restriction;
        this.ephemeral = data.ephemeral
        this.manager = client.modals;
        this.name = data.name;
        this.client = client;

        try {
            // noinspection JSIgnoredPromiseFromCall
            this.client.modals.register(this);
        } catch (err) {
            console.error(err);
            return;
        }
    }
}