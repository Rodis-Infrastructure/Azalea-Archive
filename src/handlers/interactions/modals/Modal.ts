import { ModalSubmitInteraction } from "discord.js";
import { CustomComponentProperties } from "../../../utils/Types";

import Config from "../../../utils/Config";

export default abstract class Modal {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomComponentProperties) {}
    abstract execute(interaction: ModalSubmitInteraction, config: Config): Promise<void>;
}