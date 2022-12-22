import {
    AttachmentBuilder,
    EmbedBuilder,
    GuildChannel,
    Interaction,
    TextChannel
} from "discord.js";

import {GuildConfig, LogIcon, LogType} from "./Types";

function isLoggingEnabled(data: {
    type: keyof typeof LogType,
    config: GuildConfig | undefined,
    interactionChannelId: string | null,
    interactionCategoryId: string | null,
}) {
    const {type, config, interactionChannelId, interactionCategoryId} = data;
    if (!interactionChannelId) return false;

    return (
        config?.logging?.[type]?.isEnabled &&
        config.logging[type]?.channelId &&
        !config.logging[type]?.excludedChannels?.includes(interactionChannelId) &&
        !config.logging[type]?.excludedCategories?.includes(interactionCategoryId || "N/A") &&
        !config.logging.excludedChannels?.includes(interactionChannelId) &&
        !config.logging.excludedCategories?.includes(interactionCategoryId || "N/A")
    ) as boolean;
}

export async function sendLog(data: {
    type: LogType,
    interaction: Interaction,
    config: GuildConfig | undefined,
    icon?: LogIcon,
    content?: string,
    fields?: {
        name: string,
        value: string
    }[]
}): Promise<void> {
    const {type, interaction, config} = data;
    const logTypeName = Object.keys(LogType)[Object.values(LogType).indexOf(type)] as keyof typeof LogType;
    const embedColor = config?.logging?.[logTypeName]?.embedColor || config?.colors?.embedDefault || "NotQuiteBlack";

    if (!isLoggingEnabled({
        type: logTypeName,
        interactionChannelId: interaction.channelId,
        interactionCategoryId: (interaction.channel as GuildChannel)?.parentId,
        config
    })) return;

    if (!data.content && data.fields?.length === 0) return;
    if (!config?.logging?.[logTypeName]?.channelId) return;

    const logsChannel = await interaction.guild?.channels.fetch(config?.logging?.[logTypeName].channelId) as TextChannel;
    if (!logsChannel) return;

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({name: type})
        .setFooter({text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL()})
        .setTimestamp()

    if (data.fields) embed.setFields(data.fields);
    if (data.content) embed.setDescription(data.content);

    const attachments: AttachmentBuilder[] = [];

    if (data.icon) {
        attachments.push(new AttachmentBuilder(`assets/${data.icon}.png`, {name: `${data.icon}.png`}));
        embed.data.author!.icon_url = `attachment://${data.icon}.png`;
    }

    await logsChannel.send({
        embeds: [embed],
        files: attachments
    });
}