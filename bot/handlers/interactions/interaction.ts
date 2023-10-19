import { ApplicationCommandData, ApplicationCommandType, CommandInteraction, PermissionFlagsBits } from "discord.js";
import { AnyComponentInteraction, CommandData, ComponentData } from "@/types/interactions";

import Config from "@/utils/config";

export abstract class Command {
    // @formatter:off
    protected constructor(public data: CommandData) {}
    abstract execute(interaction: CommandInteraction<"cached">, ephemeral: boolean, config: Config): Promise<void> | void;

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

export abstract class Component<ComponentInteraction extends AnyComponentInteraction<"cached">> {
    // @formatter:off
    protected constructor(public data: ComponentData) {}
    abstract execute(interaction: ComponentInteraction, ephemeral: boolean, config: Config): Promise<void> | void;
}