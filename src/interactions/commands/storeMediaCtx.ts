import {
    ApplicationCommandType,
    GuildTextBasedChannel,
    hideLinkEmbed,
    Message,
    MessageContextMenuCommandInteraction
} from "discord.js";

import { InteractionResponseType } from "../../types/interactions";
import { Command } from "../../handlers/interactions/interaction";
import { LoggingEvent } from "../../types/config";
import { sendLog } from "../../utils/logging";

import Config from "../../utils/config";

export default class StoreMediaCtxCommand extends Command {
    constructor() {
        super({
            name: "Store media",
            type: ApplicationCommandType.Message,
            defer: InteractionResponseType.Default,
            skipInternalUsageCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction, _: never, config: Config): Promise<void> {
        const { success, error } = config.emojis;
        const { targetMessage } = interaction;

        if (!config.channels?.mediaConversion) {
            await interaction.reply({
                content: `${error} This guild doesn't have a media conversion channel set up!`,
                ephemeral: true
            });
            return;
        }

        if (!targetMessage.attachments.size) {
            await interaction.reply({
                content: `${error} This message doesn't have any attachments!`,
                ephemeral: true
            });
            return;
        }

        const storedMediaLog = await sendLog({
            event: LoggingEvent.Media,
            guildId: interaction.guildId!,
            options: {
                content: `Media from ${targetMessage.author}, stored by ${interaction.user}`,
                files: Array.from(targetMessage.attachments.values()),
                allowedMentions: { parse: [] }
            }
        }) as Message<true>;

        const mediaConversionChannel = await interaction.guild!.channels.fetch(config.channels.mediaConversion) as GuildTextBasedChannel;

        await Promise.all([
            mediaConversionChannel.send(`${interaction.user} Your media log: ${storedMediaLog.url} (${hideLinkEmbed(storedMediaLog.url)})`),
            interaction.reply({
                content: `${success} Successfully stored \`${storedMediaLog.attachments.size}\` attachments from ${targetMessage.author}`,
                ephemeral: true
            })
        ]);
    }
}