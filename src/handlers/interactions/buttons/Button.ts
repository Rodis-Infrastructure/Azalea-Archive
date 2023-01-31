import { InteractionResponseType } from "../../../utils/Types";
import { ButtonInteraction } from "discord.js";

type CustomButtonComponentData = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; }
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
}

export default abstract class Button {
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;

    abstract execute(interaction: ButtonInteraction): Promise<void>;

    protected constructor(data: CustomButtonComponentData) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck;
        this.defer = data.defer;
        this.name = data.name;
    }
}
