import { ButtonInteraction, Collection, Colors, EmbedBuilder, GuildMember, GuildTextBasedChannel } from "discord.js";
import { InteractionCustomIdFilter } from "../../../interactions/interaction.types";
import { LoggingEvent, RolePermission } from "../../../utils/utils.types";
import { formatCustomId, validateCustomId } from "../../../utils";
import { sendLog } from "../../../utils/loggingUtils";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import ClientManager from "../../../client";
import Button from "./button";

export default class ButtonHandler {
    list: Collection<InteractionCustomIdFilter, Button>;

    constructor() {
        this.list = new Collection();
    }

    public async load() {
        const files = await readdir(join(__dirname, "../../../interactions/buttons"));

        for (const file of files) {
            const button = (await import(join(__dirname, "../../../interactions/buttons", file))).default;
            this.register(new button());
        }
    }

    public register(button: Button) {
        this.list.set(button.data.name, button);
    }

    public async handle(interaction: ButtonInteraction) {
        const config = ClientManager.config(interaction.guildId!);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const button = validateCustomId(this.list, interaction.customId);

        if (!button) {
            await interaction.reply({
                content: "Interaction not found.",
                ephemeral: true
            });
            return;
        }

        const formattedCustomId = formatCustomId(button.data.name);

        if (!config.actionAllowed(interaction.member as GuildMember, {
            permission: RolePermission.Button,
            requiredValue: formattedCustomId
        })) {
            await interaction.reply({
                content: "You do not have permission to use this interaction",
                ephemeral: true
            });
            return;
        }

        const usageChannel = interaction.channel as GuildTextBasedChannel;
        const ephemeral = await config.applyDeferralState({
            interaction,
            state: button.data.defer,
            skipInternalUsageCheck: button.data.skipInternalUsageCheck,
            ephemeral: button.data.ephemeral
        });

        try {
            await button.execute(interaction, ephemeral, config);
        } catch (err) {
            console.log(`Failed to execute button: ${formattedCustomId}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({ name: "Interaction Used", iconURL: "attachment://interaction.png" })
            .setDescription(`Button \`${formattedCustomId}\` used by ${interaction.user}`)
            .setFields([{
                name: "Used In",
                value: `${usageChannel} (\`#${usageChannel.name}\`)`
            }])
            .setTimestamp();

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