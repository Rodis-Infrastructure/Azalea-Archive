import {
    CommandInteraction,
    MessageApplicationCommandData,
    PermissionFlagsBits,
    UserApplicationCommandData
} from "discord.js";

import { InteractionResponseType } from "../../../utils/Types";
import Config from "../../../utils/Config";

type ContextMenuCommandData = MessageApplicationCommandData | UserApplicationCommandData;
type CustomContextMenuCommandProperties = ContextMenuCommandData & {
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
}

export default abstract class ContextMenuCommand {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomContextMenuCommandProperties) {}
    abstract execute(interaction: CommandInteraction, config: Config): Promise<void>;

    build(): ContextMenuCommandData {
        return {
            name: this.data.name,
            dmPermission: false,
            type: this.data.type,
            defaultMemberPermissions: [PermissionFlagsBits.Administrator]
        };
    }
}