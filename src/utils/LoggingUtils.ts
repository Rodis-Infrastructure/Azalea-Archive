import {AttachmentBuilder, ColorResolvable, EmbedBuilder, TextChannel, User} from "discord.js";
import {LogIcon} from "./Types";

export async function sendLog(data: {
    action: string,
    author: User,
    logsChannel: TextChannel,
    icon?: LogIcon,
    embedColor?: ColorResolvable,
    content?: string,
    fields?: {
        name: string,
        value: string
    }[]
}): Promise<void> {
    const {action, author, logsChannel, embedColor} = data;
    if (!data.content && data.fields?.length === 0) return;

    const embed = new EmbedBuilder()
        .setColor(embedColor ?? "DarkButNotBlack")
        .setAuthor({name: action})
        .setFooter({text: author.tag, iconURL: author.displayAvatarURL()})
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