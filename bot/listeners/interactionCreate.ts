import { Colors, CommandInteraction, EmbedBuilder, Events, Interaction } from "discord.js";
import { LoggingEvent, RoleInteraction } from "@bot/types/config";
import { sendLog } from "@bot/utils/logging";
import { getCustomId } from "@bot/utils";

import EventListener from "@bot/handlers/listeners/eventListener";
import Config from "@bot/utils/config";
import Cache from "@bot/utils/cache";
import { Command } from "@bot/handlers/interactions/interaction";

export default class InteractionCreateEventListener extends EventListener {
    constructor() {
        super(Events.InteractionCreate);
    }

    async execute(interaction: Interaction): Promise<void> {
        if (interaction.isAutocomplete() || !interaction.inCachedGuild() || !interaction.channel) return;

        const config = Config.get(interaction.guildId);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const cachedInteraction = interaction.isCommand()
            ? getCommand(interaction)
            : Cache.getComponent(interaction.customId);

        if (!cachedInteraction) {
            await interaction.reply({
                content: "Interaction not found.",
                ephemeral: true
            });
            return;
        }

        const { data } = cachedInteraction;
        let customId = getCustomId(data.name);

        if (!interaction.isCommand() && !config.canPerformAction(interaction.member, RoleInteraction.Button, customId)) {
            await interaction.reply({
                content: "You do not have permission to use this interaction",
                ephemeral: true
            });
            return;
        }

        const sourceChannel = interaction.channel;
        const ephemeral = await config.applyDeferralState({
            interaction,
            state: data.defer,
            skipInternalUsageCheck: data.skipInternalUsageCheck,
            ephemeral: data.ephemeral
        });

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await cachedInteraction.execute(interaction, ephemeral, config);
        } catch (err) {
            console.log(`Failed to execute interaction: ${customId}`);
            console.error(err);
            return;
        }

        // Display the full command name if it's a slash command
        if (interaction.isChatInputCommand()) {
            const subcommand = interaction.options.getSubcommand(false);
            customId = subcommand ? `/${customId} ${subcommand}` : `/${customId}`;
        }

        const log = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({ name: "Interaction Used", iconURL: "attachment://interaction.png" })
            .setDescription(`Interaction \`${customId}\` used by ${interaction.user}`)
            .setFields([{
                name: "Used In",
                value: `${sourceChannel} (\`#${sourceChannel.name}\`)`
            }])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.Interaction,
            sourceChannel,
            options: {
                embeds: [log],
                files: [{
                    attachment: "./icons/interaction.png",
                    name: "interaction.png"
                }]
            }
        });
    }
}

function getCommand({ commandName, commandType, guildId }: CommandInteraction): Command | undefined {
    const key = `${commandName}_${commandType}`;
    return Cache.globalCommands.get(key) || Cache.guildCommands.get(`${key}_${guildId}`);
}