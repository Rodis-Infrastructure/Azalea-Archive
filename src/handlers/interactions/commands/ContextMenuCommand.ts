import {
    MessageApplicationCommandData,
    UserApplicationCommandData,
    ApplicationCommandType,
    CommandInteraction
} from "discord.js";

import { InteractionResponseType } from "../../../utils/Types";

type ContextMenuCommandData = MessageApplicationCommandData | UserApplicationCommandData;
type CustomApplicationCommandData = ContextMenuCommandData & {
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
}

export default abstract class ContextMenuCommand {
    type: ApplicationCommandType.User | ApplicationCommandType.Message;
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    name: string;

    abstract execute(interaction: CommandInteraction): Promise<void>;

    protected constructor(data: CustomApplicationCommandData) {
        this.skipInternalUsageCheck = data.skipInternalUsageCheck;
        this.defer = data.defer;
        this.name = data.name;
        this.type = data.type;
    }

    build(): ContextMenuCommandData {
        return {
            name: this.name,
            dmPermission: false,
            type: this.type
        };
    }
}
