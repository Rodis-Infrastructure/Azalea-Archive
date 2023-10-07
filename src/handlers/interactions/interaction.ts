import { ApplicationCommandData, ApplicationCommandType, CommandInteraction, PermissionFlagsBits } from "discord.js";
import { AnyComponentInteraction, ComponentCustomId, InteractionResponseType } from "../../types/interactions";

import Config from "../../utils/config";

export abstract class Command {
    // @formatter:off
    protected constructor(public data: CommandData) {}
    abstract execute(interaction: CommandInteraction, ephemeral: boolean, config: Config): Promise<void>;

    build(): ApplicationCommandData {
        const { data } = this;

        // Command is a slash command
        if (data.type === ApplicationCommandType.ChatInput) {
            return {
                name: data.name,
                description: data.description,
                type: data.type,
                dmPermission: false,
                options: data.options,
                defaultMemberPermissions: [PermissionFlagsBits.ManageChannels]
            };
        }

        // Command is a context menu command
        return {
            name: data.name,
            type: data.type,
            dmPermission: false,
            defaultMemberPermissions: [PermissionFlagsBits.ManageChannels]
        };
    }
}

export abstract class Component<T extends AnyComponentInteraction> {
    // @formatter:off
    protected constructor(public data: ComponentData) {}
    abstract execute(interaction: T, ephemeral: boolean, config: Config): Promise<void>;
}

interface ComponentData {
    name: ComponentCustomId;
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    ephemeral?: boolean;
}

type CommandData = ApplicationCommandData & {
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    type: ApplicationCommandType;
    ephemeral?: boolean;
}