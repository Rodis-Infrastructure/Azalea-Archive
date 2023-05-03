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
        this.list.set(modal.name, modal);
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
            if (typeof m.name === "string") return m.name === interaction.customId;

            if ((m.name as { startsWith: string }).startsWith) {
                return interaction.customId.startsWith((m.name as {
                    startsWith: string
                }).startsWith);
            }
            if ((m.name as { endsWith: string }).endsWith) {
                return interaction.customId.endsWith((m.name as {
                    endsWith: string
                }).endsWith);
            }
            if ((m.name as { includes: string }).includes) {
                return interaction.customId.includes((m.name as {
                    includes: string
                }).includes);
            }

            return false;
        });

        if (!modal) return;

        const modalName = typeof modal.name === "string" ?
            modal.name :
            Object.values(modal.name)[0];

        if (!config.actionAllowed({
            roleProperty: RolePermission.Modal,
            id: modalName,
            member: interaction.member as GuildMember
        })) {
            await interaction.reply({
                content: "You do not have permission to use this interaction",
                ephemeral: true
            });
            return;
        }

        const channel = interaction.channel as GuildTextBasedChannel;

        const ephemeral = config.ephemeralResponseIn(channel) ?
            true :
            modal.ephemeral;

        await interaction.deferReply({ ephemeral });

        try {
            await modal.execute(interaction);
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