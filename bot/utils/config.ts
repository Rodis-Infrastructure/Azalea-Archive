import {
    AnySelectMenuInteraction,
    APIEmbed,
    ApplicationCommandOptionChoiceData,
    ButtonInteraction,
    CategoryChannel,
    Collection,
    GuildBasedChannel,
    GuildMember,
    GuildTextBasedChannel,
    Message,
    MessageMentionTypes,
    ModalSubmitInteraction,
    Role,
    SelectMenuComponentOptionData,
    Snowflake,
    userMention
} from "discord.js";

import {
    ChannelConfig,
    ConfigData,
    ConfirmationOptions,
    EmojiConfig,
    LoggingEvent, NicknameCensorshipConfig,
    NotificationOptions,
    RoleInteraction,
    RolePermission,
    RolePermissions,
    RoleRequests
} from "@bot/types/config";

import { AnyCommandInteraction, CustomId, InteractionResponseType } from "@bot/types/interactions";
import { formatReason, isGuildTextBasedChannel } from "./index";
import { InfractionModel } from "@database/models/infraction";
import { client } from "@bot/client";

export default class Config {
    private static instances = new Collection<string, Config>();

    // @formatter:off
    private constructor(public readonly guildId: string, public readonly data: ConfigData) {}

    get customCommandChoices(): ApplicationCommandOptionChoiceData<string>[] {
        return this.data.commands?.map(({ name, value }) => ({ name, value })) || [];
    }

    get proofChannelIds(): Snowflake[] {
        return this.data.proofChannelIds ?? [];
    }

    get roleRequests(): RoleRequests | undefined {
        return this.data.roleRequests;
    }

    get nicknameCensorship(): Required<Pick<NicknameCensorshipConfig, "allowedRoles" | "excludedRoles">> & Pick<NicknameCensorshipConfig, "embed"> {
        const { allowedRoles, excludedRoles, embed } = this.data.nicknameCensorship ?? {};

        return {
            allowedRoles: allowedRoles ?? [],
            excludedRoles: excludedRoles ?? [],
            embed
        };
    }

    get deleteMessageSecondsOnBan(): number {
        const val = this.data.deleteMessageSecondsOnBan ?? 0;

        if (val < 0) return 0;
        if (val > 604800) return 604800;

        return val;
    }

    get emojis(): EmojiConfig {
        const emojis = this.data.emojis ?? {};

        // Set default values
        emojis.success ||= "✅";
        emojis.error ||= "❌";

        return emojis;
    }

    get channels(): ChannelConfig {
        return this.data.channels ?? {};
    }

    private get permissions(): RolePermissions[] {
        return this.data.permissions ?? [];
    }

    static get(guildId: Snowflake): Config | undefined {
        return this.instances.get(guildId);
    }

    static create(guildId: Snowflake, data: ConfigData): Config {
        const instance = this.instances.get(guildId);
        if (instance) return instance;

        const config = new Config(guildId, data);
        Config.instances.set(guildId, config);

        return config;
    }

    /** @returns {number} The duration in milliseconds until the role is removed */
    getTemporaryRoleDuration(roleId: Snowflake): number | undefined {
        return this.data.roleRequests?.roles.find(role => role.roleId === roleId)?.duration;
    }

    async getRequestableRoleOptions(): Promise<SelectMenuComponentOptionData[]> {
        const roleIds = this.data.roleRequests?.roles.map(({ roleId }) => roleId) ?? [];
        const guild = await client.guilds.fetch(this.guildId);
        const roles = await Promise.all(roleIds.map(roleId => guild.roles.fetch(roleId)));
        const filteredRoles = roles.filter(Boolean) as Role[];

        return filteredRoles.map(role => ({
            label: role.name,
            value: role.id
        }));
    }

    isMediaChannel(channelId: Snowflake): boolean {
        return this.data.mediaChannels?.some(mediaChannel =>
            mediaChannel.channelId === channelId
        ) ?? false;
    }

    /** @returns {string | void} - The error message if the member cannot post in the media channel */
    isAllowedInMediaChannel(message: Message<true>): string | void {
        if (message.member) {
            const channel = this.data.mediaChannels?.find(mediaChannel =>
                mediaChannel.channelId === message.channelId
            );

            if (!channel?.allowedRoles?.length) return;

            const memberRoles = message.member.roles.cache;
            const hasAnyRequiredRole = channel.allowedRoles.some(roleId => memberRoles.has(roleId));

            if (!hasAnyRequiredRole) {
                return channel.fallbackResponse || "You do not have permission to post in this channel";
            }
        }

        if (!message.attachments.size && !message.content.match(/https?:\/\/\w+/g)) {
            return "This is a media-only channel, your message must have at least one attachment.";
        }
    }

    /** @param {string} value - The custom command's choice value */
    getCustomCommandResponse(value: string): APIEmbed | undefined {
        return this.data.commands?.find(command => command.value === value)?.embed;
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

    isLoggingAllowed(eventName: LoggingEvent, channel: Exclude<GuildBasedChannel, CategoryChannel>): boolean {
        if (!this.data.logging) return false;

        const {
            [eventName]: event,
            enabled,
            excludedChannels,
            excludedCategories
        } = this.data.logging;

        const channelId = channel.isThread()
            ? channel.parentId
            : channel.id;

        const categoryId = channel.isThread()
            ? channel.parent?.parentId
            : channel.parentId ?? "";

        const isEnabled = enabled && event?.enabled;
        const isEventChannelConfigured = event?.channelId;
        const isChannelExcluded = channelId && (excludedChannels?.includes(channelId) || event?.excludedChannels?.includes(channelId));
        const isCategoryExcluded = categoryId && (excludedCategories?.includes(categoryId) || event?.excludedCategories?.includes(categoryId));

        return Boolean(isEnabled && !isChannelExcluded && !isCategoryExcluded && isEventChannelConfigured);
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
        const isInfractionDeleted = infraction.archived_at && infraction.archived_by;
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

        if (!interaction.channel || interaction.channel.isDMBased()) return true;

        const ephemeral = (!skipInternalUsageCheck && this.ephemeralResponseIn(interaction.channel))
            || data.ephemeral
            || false;

        switch (state) {
            case InteractionResponseType.Defer: {
                await interaction.deferReply({ ephemeral });
                break;
            }

            case InteractionResponseType.DeferUpdate: {
                if (interaction.isCommand()) {
                    throw new Error(`Cannot defer update on a slash/context menu command (${interaction.commandName})`);
                }

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