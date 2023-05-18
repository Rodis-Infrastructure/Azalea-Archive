import { ModalSubmitInteraction } from "discord.js";
import { CustomModalProperties } from "../../../utils/Types";

import Config from "../../../utils/Config";

export default abstract class Modal {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomModalProperties) {}
    abstract execute(interaction: ModalSubmitInteraction, config: Config): Promise<void>;
}