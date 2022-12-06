import {AttachmentBuilder, ColorResolvable, EmbedBuilder, GuildMember, TextChannel, User} from "discord.js";
import Properties from "./Properties";

export default class LoggingUtils {
    public static async log(data: {
        action: string,
        author: User,
        logsChannel: TextChannel,
        icon?: string,
        color?: ColorResolvable,
        content?: string,
        fields?: {
            name: string,
            value: string
        }[]
    }): Promise<void> {
        const {action, author, logsChannel} = data;
        if (!data.content && data.fields?.length === 0) return;

        const embed = new EmbedBuilder()
            .setColor(data.color ?? Properties.colors.default)
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
}