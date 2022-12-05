import {ColorResolvable, EmbedBuilder, GuildMember, TextChannel, User} from "discord.js";
import Properties from "./Properties";

export default class LoggingUtils {
    public static async log(data: {
        action: string,
        author: User,
        logsChannel: TextChannel,
        color?: ColorResolvable,
        fields?: {
            name: string,
            value: string
        }[]
    }): Promise<void> {
        const {action, author, logsChannel} = data;
        const fields = [{
            name: "Author",
            value: `${author} (\`${author.id}\`)`
        }];

        if (data.fields) fields.push(...data.fields);

        const embed = new EmbedBuilder()
            .setColor(data.color ?? Properties.colors.default)
            .setAuthor({name: action})
            .setFields(fields)
            .setFooter({text: author.tag, iconURL: author.displayAvatarURL()})
            .setTimestamp()

        await logsChannel.send({embeds: [embed]});
    }
}