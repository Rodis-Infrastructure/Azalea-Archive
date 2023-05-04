import { ModalSubmitInteraction } from "discord.js";
import Config from "../../../utils/Config";

interface CustomModalProperties {
    name: string | { startsWith: string } | { endsWith: string } | { includes: string };
    skipInternalUsageCheck: boolean;
    ephemeral: boolean;
}

export default abstract class Modal {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomModalProperties) {}
    abstract execute(interaction: ModalSubmitInteraction, config: Config): Promise<void>;
}