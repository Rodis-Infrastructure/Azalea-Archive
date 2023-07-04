import {
    CommandInteraction,
    MessageApplicationCommandData,
    PermissionFlagsBits,
    UserApplicationCommandData
} from "discord.js";

import { InteractionResponseType } from "../../../interactions/interaction.types";
import Config from "../../../utils/config";

type ContextMenuCommandData = MessageApplicationCommandData | UserApplicationCommandData;
type CustomContextMenuCommandProperties = ContextMenuCommandData & {
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    ephemeral?: boolean;
}

export default abstract class ContextMenuCommand {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomContextMenuCommandProperties) {}
    abstract execute(interaction: CommandInteraction, ephemeral: boolean, config: Config): Promise<void>;

    build(): ContextMenuCommandData {
        return {
            name: this.data.name,
            dmPermission: false,
            type: this.data.type,
            defaultMemberPermissions: [PermissionFlagsBits.ManageChannels]
        };
    }
}