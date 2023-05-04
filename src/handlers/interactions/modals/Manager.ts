import ClientManager from "../../../Client";
import Modal from "./Modal";

import { Collection, EmbedBuilder, GuildMember, GuildTextBasedChannel, ModalSubmitInteraction } from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sendLog } from "../../../utils/LoggingUtils";
import { LoggingEvent, RolePermission } from "../../../utils/Types";


export default class ModalHandler {
    list: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, Modal>;

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

        const modal = this.list.find(m => {
            const { name } = m.data;
            if (typeof name === "string") return name === interaction.customId;

            if ((name as { startsWith: string }).startsWith) {
                return interaction.customId.startsWith((name as {
                    startsWith: string
                }).startsWith);
            }
            if ((name as { endsWith: string }).endsWith) {
                return interaction.customId.endsWith((name as {
                    endsWith: string
                }).endsWith);
            }
            if ((name as { includes: string }).includes) {
                return interaction.customId.includes((name as {
                    includes: string
                }).includes);
            }

            return false;
        });

        if (!modal) return;
        const { name, ephemeral } = modal.data;

        const modalName = typeof name === "string" ?
            name :
            Object.values(name)[0];

        if (!config.actionAllowed(interaction.member as GuildMember, {
            property: RolePermission.Modal,
            value: modalName
        })) {
            await interaction.reply({
                content: "You do not have permission to use this interaction",
                ephemeral: true
            });
            return;
        }

        const channel = interaction.channel as GuildTextBasedChannel;

        const ephemeralResponse = config.ephemeralResponseIn(channel) ?
            true :
            ephemeral;

        await interaction.deferReply({ ephemeral: ephemeralResponse });

        try {
            await modal.execute(interaction, config);
        } catch (err) {
            console.log(`Failed to execute modal: ${modalName}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(0x2e3136)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`Modal \`${modalName}\` used by ${interaction.user}`)
            .setFields([{
                name: "Channel",
                value: `${channel} (\`#${channel.name}\`)`
            }])
            .setTimestamp();

        await sendLog({
            event: LoggingEvent.InteractionUsage,
            embed: log,
            channel
        });
    }
}