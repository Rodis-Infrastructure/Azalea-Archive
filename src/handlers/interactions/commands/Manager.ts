import { ApplicationCommandType, Collection, Colors, EmbedBuilder, GuildTextBasedChannel } from "discord.js";

import { Command, CommandInteraction, InteractionResponseType, LoggingEvent } from "../../../utils/Types";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sendLog } from "../../../utils/LoggingUtils";

import ClientManager from "../../../Client";

export default class CommandHandler {
    list: Collection<string, Command>;

    constructor() {
        this.list = new Collection();
    }

    public async load() {
        const files = await readdir(join(__dirname, "../../../interactions/commands"));

        for (const file of files) {
            const command = (await import(join(__dirname, "../../../interactions/commands", file))).default;
            this.register(new command());
        }
    }

    public register(command: Command) {
        this.list.set(`${command.data.name}_${command.data.type}`, command);
    }

    public async publish() {
        const commandData = ClientManager.commands.list.map(command => command.build());

        try {
            await ClientManager.client.application?.commands.set(commandData);
            console.log(`Successfully loaded ${ClientManager.commands.list.size} commands!`);
        } catch (err) {
            console.error(err);
        }
    }

    public async handle(interaction: CommandInteraction) {
        const config = ClientManager.config(interaction.guildId!);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const command = this.list.get(`${interaction.commandName}_${interaction.commandType}`);

        if (!command) {
            await interaction.reply({
                content: "Interaction not found.",
                ephemeral: true
            });
            return;
        }

        const usageChannel = interaction.channel as GuildTextBasedChannel;
        const replyDeferralType = config.ephemeralResponseIn(usageChannel)
            ? InteractionResponseType.EphemeralDefer
            : command.data.defer;

        switch (replyDeferralType) {
            case InteractionResponseType.Defer: {
                await interaction.deferReply();
                break;
            }

            case InteractionResponseType.EphemeralDefer: {
                await interaction.deferReply({ ephemeral: true });
            }
        }

        try {
            await command.execute(interaction, config);
        } catch (err) {
            console.log(`Failed to execute command: ${command.data.name}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({ name: "Interaction Used", iconURL: "attachment://interaction.png" })
            .setDescription(`Command \`${command.data.name}\` used by ${interaction.user}`)
            .setFields([{
                name: "Channel",
                value: `${usageChannel} (\`#${usageChannel.name}\`)`
            }])
            .setTimestamp();

        if (interaction.commandType !== ApplicationCommandType.ChatInput) {
            let targetUserId = interaction.targetId;
            if (interaction.commandType === ApplicationCommandType.Message) targetUserId = interaction.targetMessage.author.id;

            log.addFields([{
                name: "Target",
                value: `<@${targetUserId}> (\`${targetUserId}\`)`
            }]);
        }

        await sendLog({
            event: LoggingEvent.Interaction,
            channel: usageChannel,
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