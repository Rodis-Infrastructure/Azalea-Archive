import {ModalSubmitInteraction} from "discord.js";

type CustomModalComponent = {
    name: string | { startsWith: string; } | { endsWith: string; } | { includes: string; };
    skipInternalUsageCheck: boolean;
    ephemeral: boolean;
}

export default abstract class Modal {
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    skipInternalUsageCheck: boolean;
    ephemeral: boolean;

    abstract execute(interaction: ModalSubmitInteraction): Promise<void>;

    protected constructor(data: CustomModalComponent) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck;
        this.ephemeral = data.ephemeral;
        this.name = data.name;
    }
}