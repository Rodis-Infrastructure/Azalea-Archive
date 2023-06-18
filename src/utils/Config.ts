import {
    ButtonInteraction,
    Guild,
    GuildMember,
    GuildTextBasedChannel,
    ModalSubmitInteraction,
    SelectMenuInteraction,
    userMention
} from "discord.js";
import {
    CommandInteraction,
    ConfigData,
    Infraction,
    InteractionResponseType,
    LoggingEvent,
    PermissionData
} from "./Types";

import ClientManager from "../Client";
import { formatReason } from "./index";

export default class Config {
    // @formatter:off
    // eslint-disable-next-line no-empty-function
    constructor(public readonly data: ConfigData) {}

    get deleteMessageSecondsOnBan() {
        return this.data.deleteMessageSecondsOnBan ?? 0;
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

    private get confirmationChannel() {
        return this.data.confirmationChannel;
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
                if (group.roleIds.some(roleId => member.roles.cache.has(roleId))) {
                    return true;
                }
            }
        }

        return false;
    }

    guildStaffRoles(): string[] {
        const roles = this.roles.filter(role => role.guildStaff).map(role => role.id);
        const groups = this.groups.filter(group => group.guildStaff).flatMap(group => group.roleIds);

        return [...new Set([...roles, ...groups])];
    }

    isGuildStaff(member: GuildMember): boolean {
        return this.guildStaffRoles().some(roleId => member.roles.cache.has(roleId));
    }

    async sendInfractionConfirmation(data: {
        guild: Guild,
        authorId?: string,
        message: string,
        reason?: string | null,
        full?: boolean,
        channelId?: string
    }) {
        const { guild, authorId, message, reason, full, channelId } = data;

        if (!this.confirmationChannel) return;
        if (channelId && channelId === this.confirmationChannel) return;

        const confirmationChannelId = this.confirmationChannel;
        if (!confirmationChannelId) return;

        const confirmationChannel = await guild.channels.fetch(confirmationChannelId) as GuildTextBasedChannel;
        if (!confirmationChannel) return;

        confirmationChannel.send({
            content: full ? message : `${this.emojis.success} ${userMention(authorId!)} has successfully ${message}${formatReason(reason)}`,
            allowedMentions: { parse: [] }
        });
    }

    canManageInfraction(infraction: Infraction, member: GuildMember): void {
        const canManage = this.actionAllowed(member, {
            permission: "manageInfractions",
            requiredValue: true
        });

        if (!infraction) throw "Infraction not found";
        if (!canManage && infraction.executorId !== member.id) throw "You do not have permission to manage this infraction";
        if (infraction.deletedAt && infraction.deletedBy) throw "This infraction has been deleted and cannot be changed";
    }

    async applyDeferralState(data: {
        interaction: ModalSubmitInteraction | ButtonInteraction | SelectMenuInteraction | CommandInteraction,
        state: InteractionResponseType,
        ephemeral?: boolean
    }) {
        const { interaction, state } = data;
        const ephemeral = this.ephemeralResponseIn(interaction.channel as GuildTextBasedChannel) || data.ephemeral;

        switch (state) {
            case InteractionResponseType.Defer: {
                await interaction.deferReply({ ephemeral });
                break;
            }

            case InteractionResponseType.DeferUpdate: {
                if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) throw "Cannot defer update on a slash/context menu command";
                await interaction.deferUpdate();
            }
        }
    }

    userFlags(member: GuildMember) {
        const flags = [];

        for (const flag of this.data.userFlags || []) {
            if (member.roles.cache.some(role => flag.roleIds.includes(role.id))) {
                flags.push(flag.name);
            }
        }

        return flags;
    }
}