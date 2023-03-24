import {
    ConfigData,
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
    logging: ConfigData["logging"];
    ephemeralResponses: ConfigData["ephemeralResponses"];
    roles: NonNullable<ConfigData["roles"]>;
    groups: NonNullable<ConfigData["groups"]>;

    constructor(guildId: string, data: ConfigData) {
        this.guildId = guildId;
        this.logging = data.logging;
        this.ephemeralResponses = data.ephemeralResponses;
        this.roles = data.roles ?? [];
        this.groups = data.groups ?? [];
    }

    save() {
        ClientManager.configs.set(this.guildId, this);
    }

    loggingChannel(event: LoggingEvent): string | undefined {
        return this.logging?.[event]?.channelId;
    }

    canLog(eventName: LoggingEvent, channel: GuildTextBasedChannel): boolean {
        if (!this.logging) return false;

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
        if (!this.ephemeralResponses) return false;

        const { enabled, excludedChannels, excludedCategories } = this.ephemeralResponses;
        const categoryId = channel.parentId ?? "None";

        return (
            enabled &&
            !excludedChannels?.includes(channel.id) &&
            !excludedCategories?.includes(categoryId)
        ) as boolean;
    }

    interactionAllowed(interaction: MessageComponentInteraction | ModalSubmitInteraction): boolean {
        if (this.roles.length === 0 && this.groups.length === 0) return false;

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
                    interactionType = "selectMenus";
                    break;
            }
        }

        for (const role of this.roles) {
            if (role[interactionType]?.includes(customId)) {
                if (member.roles.cache.has(role.id)) {
                    return true;
                }
            }
        }

        for (const group of this.groups) {
            if (group[interactionType]?.includes(customId)) {
                if (group.roles.some(roleId => member.roles.cache.has(roleId))) {
                    return true;
                }
            }
        }

        return false;
    }

    guildStaffRoles(): string[] {
        const roles = this.roles.filter(role => role.guildStaff).map(role => role.id);
        const groups = this.groups.filter(group => group.guildStaff).flatMap(group => group.roles);

        return [...new Set([...roles, ...groups])];
    }
}
