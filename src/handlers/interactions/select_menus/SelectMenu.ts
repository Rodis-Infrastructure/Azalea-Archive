import {InteractionResponseType} from "../../../utils/Types";
import {SelectMenuInteraction} from "discord.js";

type CustomSelectMenuComponent = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; };
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
}

export default abstract class SelectMenu {
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;

    abstract execute(interaction: SelectMenuInteraction): Promise<void>;

    protected constructor(data: CustomSelectMenuComponent) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck;
        this.defer = data.defer;
        this.name = data.name;
    }
}