import { CustomComponentProperties } from "../../../types/interactions";
import { ModalSubmitInteraction } from "discord.js";

import Config from "../../../utils/config";

export default abstract class Modal {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomComponentProperties) {}
    abstract execute(interaction: ModalSubmitInteraction, ephemeral: boolean, config: Config): Promise<void>;
}