import { ApplicationCommandType, Message, MessageContextMenuCommandInteraction } from "discord.js";
import { InteractionResponseType } from "../../types/interactions";

import ContextMenuCommand from "../../handlers/interactions/commands/contextMenuCommand";
import Config from "../../utils/config";
import { sendLog } from "../../utils/logging";
import { LoggingEvent } from "../../types/config";

export default class StoreMediaCtxCommand extends ContextMenuCommand {
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

        if (!targetMessage.attachments.size) {
            await interaction.reply({
                content: `${error} This message doesn't have any attachments!`,
                ephemeral: true
            });

            return;
        }

        const mediaUrls = [];
        const storedMediaLog = await sendLog({
            event: LoggingEvent.Media,
            guildId: interaction.guildId!,
            options: {
                content: `Media from ${targetMessage.author}, stored by ${interaction.user}`,
                files: Array.from(targetMessage.attachments.values()),
                allowedMentions: { parse: [] }
            }
        }) as Message<true>;

        for (const attachment of storedMediaLog.attachments.values()) {
            mediaUrls.push(`<${attachment.url}>`);
        }

        await Promise.all([
            config.sendConfirmation({
                guild: interaction.guild!,
                allowMentions: true,
                message: `${interaction.user} Your media links:\n\n>>> ${mediaUrls.join("\n")}`,
                full: true
            }),
            interaction.reply({
                content: `${success} Successfully stored \`${mediaUrls.length}\` attachments from ${targetMessage.author}`,
                ephemeral: true
            })
        ]);
    }
}