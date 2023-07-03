import {
    Collection,
    Colors,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    ModalSubmitInteraction
} from "discord.js";
import { InteractionCustomIdFilter } from "../../../types/interactions";
import { LoggingEvent, RolePermission } from "../../../types/config";
import { formatCustomId, validateCustomId } from "../../../utils";
import { sendLog } from "../../../utils/logging";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import ClientManager from "../../../client";
import Modal from "./modal";

export default class ModalHandler {
    list: Collection<InteractionCustomIdFilter, Modal>;

    constructor() {
        this.list = new Collection();
    }

    public async load() {
        const files = await readdir(join(__dirname, "../../../interactions/modals"));

        for (const file of files) {
            const modal = (await import(join(__dirname, "../../../interactions/modals", file))).default;
            this.register(new modal());
        }
    }

    public register(modal: Modal) {
        this.list.set(modal.data.name, modal);
    }

    public async handle(interaction: ModalSubmitInteraction) {
        const config = ClientManager.config(interaction.guildId as string);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const modal = validateCustomId(this.list, interaction.customId);

        if (!modal) {
            await interaction.reply({
                content: "Interaction not found.",
                ephemeral: true
            });
            return;
        }

        const formattedCustomId = formatCustomId(modal.data.name);

        if (!config.actionAllowed(interaction.member as GuildMember, {
            permission: RolePermission.Modal,
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
            state: modal.data.defer,
            skipInternalUsageCheck: modal.data.skipInternalUsageCheck,
            ephemeral: modal.data.ephemeral
        });

        try {
            await modal.execute(interaction, ephemeral, config);
        } catch (err) {
            console.log(`Failed to execute modal: ${formattedCustomId}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({ name: "Interaction Used", iconURL: "attachment://interaction.png" })
            .setDescription(`Modal \`${formattedCustomId}\` used by ${interaction.user}`)
            .setFields([{
                name: "Channel",
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