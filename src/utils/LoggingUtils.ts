import {
    AttachmentBuilder,
    EmbedBuilder,
    GuildChannel,
    TextChannel
} from "discord.js";

import {GuildConfig, LogData, LogType} from "./Types";

function isLoggingAllowed(data: {
    type: keyof typeof LogType,
    config: GuildConfig | undefined,
    interactionChannelId: string | null,
    interactionCategoryId: string | null,
}) {
    const {type, config, interactionChannelId, interactionCategoryId} = data;
    if (!interactionChannelId) return false;

    return (
        config?.logging?.isEnabled &&
        config.logging[type]?.isEnabled &&
        config.logging[type]?.channelId &&
        !config.logging[type]?.excludedChannels?.includes(interactionChannelId) &&
        !config.logging[type]?.excludedCategories?.includes(interactionCategoryId || "N/A") &&
        !config.logging.excludedChannels?.includes(interactionChannelId) &&
        !config.logging.excludedCategories?.includes(interactionCategoryId || "N/A")
    ) as boolean;
}

export async function sendLog(data: LogData): Promise<void> {
    const {type, interaction, config} = data;
    const logTypeName = Object.keys(LogType)[Object.values(LogType).indexOf(type)] as keyof typeof LogType;
    const embedColor = config?.logging?.[logTypeName]?.embedColor || config?.colors?.embedDefault || "NotQuiteBlack";

    if (!isLoggingAllowed({
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