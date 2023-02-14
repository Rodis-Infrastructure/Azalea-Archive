import {
    ConfigData,
    LoggingData,
    ToggleablePropertyData,
    PermissionData,
    StringInteractionType,
    LoggingEvent
} from "./Types";

import {
    GuildMember,
    InteractionType,
    ComponentType,
    MessageComponentInteraction,
    ModalSubmitInteraction,
    GuildTextBasedChannel
} from "discord.js";

import ClientManager from "../Client";

export default class Config {
    guildId: string;
    logging: LoggingData;
    ephemeralResponses: ToggleablePropertyData;
    permissions: PermissionData;

    constructor(guildId: string, data: ConfigData) {
        this.guildId = guildId;
        this.logging = data.logging || {};
        this.ephemeralResponses = data.ephemeralResponses || {};
        this.permissions = data.permissions || {};
    }

    save() {
        ClientManager.configs.set(this.guildId, this);
    }

    loggingChannel(event: LoggingEvent): string | undefined {
        return this.logging[event]?.channelId;
    }

    canLog(eventName: LoggingEvent, channel: GuildTextBasedChannel): boolean {
        const { [eventName]: event, enabled, excludedChannels, excludedCategories } = this.logging;
        const categoryId = channel.parentId ?? "None";

        return (
            enabled &&
            !excludedChannels?.includes(channel.id) &&
            !excludedCategories?.includes(categoryId) &&

            event?.enabled &&
            event.channelId &&
            !event.excludedChannels?.includes(channel.id) &&
            !event.excludedCategories?.includes(categoryId)
        ) as boolean;
    }

    ephemeralResponseIn(channel: GuildTextBasedChannel): boolean {
        const { enabled, excludedChannels, excludedCategories } = this.ephemeralResponses;
        const categoryId = channel.parentId ?? "None";

        return (
            enabled &&
            !excludedChannels?.includes(channel.id) &&
            !excludedCategories?.includes(categoryId)
        ) as boolean;
    }

    interactionAllowed(interaction: MessageComponentInteraction | ModalSubmitInteraction): boolean {
        const member = interaction.member as GuildMember;
        if (!member) return false;

        const { customId } = interaction;
        let interactionType: StringInteractionType = "modals";

        if (interaction.type === InteractionType.MessageComponent) {
            switch (interaction.componentType) {
                case ComponentType.Button:
                    interactionType = "buttons";
                    break;

                case ComponentType.SelectMenu:
                    interactionType = "selections";
                    break;
            }
        }

        let allowed = false;

        for (const [roleId, interactions] of Object.entries(this.permissions.roles || {})) {
            if (interactions[interactionType]?.includes(customId)) {
                if (member.roles.cache.has(roleId)) {
                    allowed = true;
                    break;
                }
            }
        }

        for (const data of Object.values(this.permissions.groups || {})) {
            if (data[interactionType]?.includes(customId)) {
                if (data.roles.some(roleId => member.roles.cache.has(roleId))) {
                    allowed = true;
                    break;
                }
            }
        }

        return allowed;
    }
}
