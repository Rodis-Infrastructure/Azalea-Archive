import { CustomComponentProperties } from "../../../types/interactions";
import { AnySelectMenuInteraction } from "discord.js";

import Config from "../../../utils/config";

export default abstract class SelectMenu {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomComponentProperties) {}
    abstract execute(interaction: AnySelectMenuInteraction, ephemeral: boolean, config: Config): Promise<void>;
}