import {
    AnySelectMenuInteraction,
    ButtonInteraction,
    Collection,
    GuildMember,
    GuildTextBasedChannel,
    MessageMentionTypes,
    ModalSubmitInteraction,
    Snowflake,
    userMention
} from "discord.js";

import {
    ChannelConfig,
    ConfigData,
    ConfirmationOptions,
    EmojiConfig,
    LoggingEvent,
    NoticeConfig,
    NotificationOptions,
    RoleInteraction,
    RolePermission,
    RolePermissions
} from "../types/config";

import { AnyCommandInteraction, InteractionResponseType } from "../types/interactions";
import { formatReason, isGuildTextBasedChannel } from "./index";
import { InfractionModel } from "../types/db";
import { CustomId } from "../types/utils";
import { client } from "../client";

export default class Config {
    private static instances = new Collection<string, Config>();

    // @formatter:off
    private constructor(public readonly data: ConfigData) {}

    get guildId(): Snowflake {
        return this.data.guildId;
    }

    get proofChannelIds(): Snowflake[] {
        return this.data.proofChannelIds ?? [];
    }

    get deleteMessageSecondsOnBan(): number {
        const val = this.data.deleteMessageSecondsOnBan ?? 0;

        if (val < 0) return 0;
        if (val > 604800) return 604800;

        return val;
    }

    get emojis(): EmojiConfig {
        return this.data.emojis ?? {
            success: "✅",
            error: "❌"
        };
    }

    get channels(): ChannelConfig {
        return this.data.channels ?? {};
    }

    get banRequestNotices(): NoticeConfig | undefined {
        return this.data.notices?.banRequests;
    }

    get muteRequestNotices(): NoticeConfig | undefined {
        return this.data.notices?.muteRequests;
    }

    private get permissions(): RolePermissions[] {
        return this.data.permissions ?? [];
    }

    static get(guildId: Snowflake): Config | undefined {
        return this.instances.get(guildId);
    }

    static create(guildId: Snowflake, data: ConfigData): Config {
        const config = new Config(data);
        Config.instances.set(guildId, config);
        return config;
    }

    getAutoReactions(channelId: Snowflake): string[] {
        const autoReactions = this.data.autoReactions ?? [];
        return autoReactions
            .filter(property => property.channelId === channelId)
            .flatMap(({ reactions }) => reactions);
    }

    getLoggingChannel(event: LoggingEvent): Snowflake | undefined {
        return this.data.logging?.[event]?.channelId;
    }

    isLoggingAllowed(eventName: LoggingEvent, channel: GuildTextBasedChannel): boolean {
        if (!this.data.logging) return false;

        const {
            [eventName]: event,
            enabled,
            excludedChannels,
            excludedCategories
        } = this.data.logging;

        const categoryId = channel.parentId || "";

        return (
            // Global logging is enabled and the channel/category is not excluded
            enabled &&
            !excludedChannels?.includes(channel.id) &&
            !excludedCategories?.includes(categoryId) &&

            // The event's logging is enabled and the channel/category is not excluded
            event?.enabled &&
            event.channelId &&
            !event.excludedChannels?.includes(channel.id) &&
            !event.excludedCategories?.includes(categoryId)
        ) as boolean;
    }

    /** Whether interaction responses in the specified channel must be ephemeral */
    ephemeralResponseIn(channel: GuildTextBasedChannel): boolean {
        if (!this.data.ephemeralResponses) return false;

        const { enabled, excludedChannels, excludedCategories } = this.data.ephemeralResponses;
        const categoryId = channel.parentId ?? "";

        return (
            // Ephemeral responses are enabled and the channel/category is not excluded
            enabled &&
            !excludedChannels?.includes(channel.id) &&
            !excludedCategories?.includes(categoryId)
        ) as boolean;
    }

    hasPermission(member: GuildMember, permission: RolePermission): boolean {
        for (const data of this.permissions) {
            const hasRole = data.roleIds.some(roleId => member.roles.cache.has(roleId));
            const isPermitted = data[permission];

            if (hasRole && isPermitted) return true;
        }

        return false;
    }

    canPerformAction(member: GuildMember, interactionType: RoleInteraction, customId: CustomId): boolean {
        for (const data of this.permissions) {
            const hasRole = data.roleIds.some(roleId => member.roles.cache.has(roleId));
            const isPermitted = data[interactionType]?.includes(customId);

            if (isPermitted && hasRole) return true;
        }

        return false;
    }

    guildStaffRoles(): Snowflake[] {
        const roleIds = this.permissions
            .filter(data => data.guildStaff)
            .flatMap(group => group.roleIds);

        // Remove duplicate values using a set
        return [...new Set(roleIds)];
    }

    isGuildStaff(member: GuildMember): boolean {
        return this.guildStaffRoles().some(roleId => member.roles.cache.has(roleId));
    }

    formatConfirmation(message: string, options: ConfirmationOptions): string {
        const { executorId, reason, success } = options;

        return success
            ? `${this.emojis.success} ${userMention(executorId)} has successfully ${message}${formatReason(reason)}`
            : `${this.emojis.error} ${userMention(executorId)} failed to ${message}`;
    }

    async sendNotification(message: string, options?: NotificationOptions): Promise<void> {
        if (!this.channels.notifications) return;
        if (options?.sourceChannelId && options.sourceChannelId === this.channels.notifications) return;

        const notificationChannel = await client.channels
            .fetch(this.channels.notifications)
            .catch(err => {
                throw new Error(`Failed to fetch notification channel: ${err}`);
            });

        if (!notificationChannel) return;
        if (!isGuildTextBasedChannel(notificationChannel)) {
            throw new Error(`The notification channel must be a guild text based channel`);
        }

        const parsedMentions: MessageMentionTypes[] = [];
        if (options?.allowMentions) parsedMentions.push("users");

        await notificationChannel.send({
            content: message,
            allowedMentions: { parse: parsedMentions }
        });
    }

    canManageInfraction(infraction: InfractionModel, member: GuildMember): boolean {
        const isInfractionDeleted = infraction.deleted_at && infraction.deleted_by;
        const isInfractionExecutor = infraction.executor_id !== member.id;
        const canManageInfractions = this.hasPermission(member, RolePermission.ManageInfractions);

        return !isInfractionDeleted && (canManageInfractions || isInfractionExecutor);
    }

    async applyDeferralState(data: {
        interaction: ModalSubmitInteraction | ButtonInteraction | AnySelectMenuInteraction | AnyCommandInteraction,
        state: InteractionResponseType,
        skipInternalUsageCheck: boolean
        ephemeral?: boolean
    }): Promise<boolean> {
        const { interaction, state, skipInternalUsageCheck } = data;
        const ephemeral = (!skipInternalUsageCheck && this.ephemeralResponseIn(interaction.channel as GuildTextBasedChannel))
            || data.ephemeral
            || false;

        switch (state) {
            case InteractionResponseType.Defer: {
                await interaction.deferReply({ ephemeral });
                break;
            }

            case InteractionResponseType.DeferUpdate: {
                if (interaction.isCommand()) throw `Cannot defer update on a slash/context menu command (${interaction.commandName})`;
                await interaction.deferUpdate();
            }
        }

        return ephemeral;
    }

    userFlags(member: GuildMember): string[] {
        const flags: string[] = [];

        for (const flag of this.data.userFlags || []) {
            if (member.roles.cache.some(role => flag.roleIds.includes(role.id))) {
                flags.push(flag.name);
            }
        }

        return flags;
    }
}