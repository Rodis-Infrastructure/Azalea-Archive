import { AnyComponentInteraction, InteractionCustomIdFilter, InteractionResponseType } from "../../types/interactions";
import { ApplicationCommandData, ApplicationCommandType, CommandInteraction, PermissionFlagsBits } from "discord.js";

import Config from "../../utils/config";

export abstract class Command {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomCommandProperties) {}
    abstract execute(interaction: CommandInteraction, ephemeral: boolean, config: Config): Promise<void>;

    build(): ApplicationCommandData {
        const { data } = this;

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

        return {
            name: data.name,
            type: data.type,
            dmPermission: false,
            defaultMemberPermissions: [PermissionFlagsBits.ManageChannels]
        };
    }
}

export abstract class ComponentInteraction<T extends AnyComponentInteraction> {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    protected constructor(public data: CustomComponentProperties) {}
    abstract execute(interaction: T, ephemeral: boolean, config: Config): Promise<void>;
}

interface CustomComponentProperties {
    name: InteractionCustomIdFilter;
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    ephemeral?: boolean;
}

type CustomCommandProperties = ApplicationCommandData & {
    skipInternalUsageCheck: boolean;
    defer: InteractionResponseType;
    type: ApplicationCommandType;
    ephemeral?: boolean;
}