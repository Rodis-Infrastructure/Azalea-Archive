import { GuildMember, GuildTextBasedChannel } from "discord.js";
import { ConfigData, LoggingEvent, PermissionData } from "./Types";

import ClientManager from "../Client";

export default class Config {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    constructor(private readonly data: ConfigData) {}

    get deleteMessageSecondsOnBan() {
        return this.data.deleteMessageSecondsOnBan ?? 0;
    }

    get channels() {
        return this.data.channels ?? {};
    }

    get emojis() {
        return this.data.emojis ?? {
            success: "✅",
            error: "❌"
        };
    }

    private get logging() {
        return this.data.logging;
    }

    private get ephemeralResponses() {
        return this.data.ephemeralResponses;
    }

    private get roles() {
        return this.data.roles ?? [];
    }

    private get groups() {
        return this.data.groups ?? [];
    }

    bind(guildId: string) {
        ClientManager.configs.set(guildId, this);
        console.log(`Bound configuration to guild (${guildId})`);
    }

    loggingChannel(event: LoggingEvent): string | undefined {
        return this.logging?.[event]?.channelId;
    }

    loggingAllowed(eventName: LoggingEvent, channel: GuildTextBasedChannel): boolean {
        if (!this.logging) return false;

        const {
            [eventName]: event,
            enabled,
            excludedChannels,
            excludedCategories
        } = this.logging;

        const categoryId = channel.parentId ?? "";

        return (
            /* Global logging is enabled and the channel/category is not excluded */
            enabled &&
            !excludedChannels?.includes(channel.id) &&
            !excludedCategories?.includes(categoryId) &&

            /* The event's logging is enabled and the channel/category is not excluded */
            event?.enabled &&
            event.channelId &&
            !event.excludedChannels?.includes(channel.id) &&
            !event.excludedCategories?.includes(categoryId)
        ) as boolean;
    }

    ephemeralResponseIn(channel: GuildTextBasedChannel): boolean {
        if (!this.ephemeralResponses) return false;

        const { enabled, excludedChannels, excludedCategories } = this.ephemeralResponses;
        const categoryId = channel.parentId ?? "";

        return (
            /* Ephemeral responses are enabled and the channel/category is not excluded */
            enabled &&
            !excludedChannels?.includes(channel.id) &&
            !excludedCategories?.includes(categoryId)
        ) as boolean;
    }

    actionAllowed(member: GuildMember, data: { permission: keyof PermissionData, requiredValue: string | boolean }): boolean {
        if (!this.roles.length && !this.groups.length) return false;
        const { permission, requiredValue } = data;

        for (const role of this.roles) {
            const permissionValue = role[permission];

            if (
                /* Permission value is a boolean */
                (!Array.isArray(permissionValue) && permissionValue === requiredValue) ||
                /* Permission value is an array of strings */
                (Array.isArray(permissionValue) && permissionValue?.includes(requiredValue as string))
            ) {
                if (member.roles.cache.has(role.id)) {
                    return true;
                }
            }
        }

        for (const group of this.groups) {
            const permissionValue = group[permission];

            if (
                /* Permission value is a boolean */
                (!Array.isArray(permissionValue) && permissionValue === requiredValue) ||
                /* Permission value is an array of strings */
                (Array.isArray(permissionValue) && permissionValue?.includes(requiredValue as string))
            ) {
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

    isGuildStaff(member: GuildMember): boolean {
        return this.guildStaffRoles().some(roleId => member.roles.cache.has(roleId));
    }
}