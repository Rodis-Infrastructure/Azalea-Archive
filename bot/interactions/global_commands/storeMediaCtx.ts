import { ApplicationCommandType, hideLinkEmbed, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "@bot/types/interactions";
import { Command } from "@bot/handlers/interactions/interaction";
import { LoggingEvent } from "@bot/types/config";
import { sendLog } from "@bot/utils/logging";

import Config from "@bot/utils/config";

export default class StoreMediaCtxCommand extends Command {
    constructor() {
        super({
            name: "Store media",
            type: ApplicationCommandType.Message,
            defer: InteractionResponseType.Default,
            skipEphemeralCheck: false
        });
    }

    async execute(interaction: MessageContextMenuCommandInteraction<"cached">, _ephemeral: never, config: Config): Promise<void> {
        const { emojis } = config;
        const { targetMessage } = interaction;

        if (!config.channels.mediaConversion) {
            await interaction.reply({
                content: `${emojis.error} This guild doesn't have a media conversion channel set up!`,
                ephemeral: true
            });
            return;
        }

        if (!targetMessage.attachments.size) {
            await interaction.reply({
                content: `${emojis.error} This message doesn't have any attachments!`,
                ephemeral: true
            });
            return;
        }

        const log = await sendLog({
            event: LoggingEvent.Media,
            guildId: interaction.guildId,
            options: {
                content: `Media from ${targetMessage.author}, stored by ${interaction.user}`,
                files: Array.from(targetMessage.attachments.values()),
                allowedMentions: { parse: [] }
            }
        });

        if (!log) {
            await interaction.reply({
                content: `${emojis.error} Unable to store media!`,
                ephemeral: true
            });
            return;
        }

        const mediaConversionChannel = await interaction.guild.channels.fetch(config.channels.mediaConversion);

        if (!mediaConversionChannel || !mediaConversionChannel.isTextBased()) {
            await interaction.reply({
                content: `${emojis.error} Unable to find the media conversion channel!`,
                ephemeral: true
            });
            return;
        }

        await Promise.all([
            mediaConversionChannel.send(`${interaction.user} Your media log: ${log.url}\n\n> ${hideLinkEmbed(log.url)}`),
            interaction.reply({
                content: `${emojis.success} Successfully stored \`${log.attachments.size}\` attachments from ${targetMessage.author}`,
                ephemeral: true
            })
        ]);
    }
}