import {Collection, ModalSubmitInteraction, TextChannel, Client} from "discord.js";
import {verifyInteractionPermissions} from "../../../utils/RestrictionUtils";
import {createLog} from "../../../utils/LoggingUtils";
import {globalGuildConfigs} from "../../../Client";
import {readdir} from "node:fs/promises";
import {join} from "node:path";

import Modal from "./Modal";

export default class ModalHandler {
    client: Client;
    list: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, Modal>;

    constructor(client: Client) {
        this.client = client;
        this.list = new Collection();
    }

    public async load() {
        let files = await readdir(join(__dirname, "../../../interactions/modals"))
        files = files.filter(file => file.endsWith(".js"));

        for (const file of files) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const modal = require(join(__dirname, "../../../interactions/modals", file)).default;
            await this.register(new modal(this.client));
        }
    }

    public async register(modal: Modal) {
        this.list.set(modal.name, modal);
    }

    public async handle(interaction: ModalSubmitInteraction) {
        const config = globalGuildConfigs.get(interaction.guildId as string);

        if (!config) {
            await interaction.reply({
                content: "Guild not configured.",
                ephemeral: true
            });
            return;
        }

        const modal = this.list.find(m => {
            if (typeof m.name === "string") return m.name === interaction.customId;

            if ((m.name as { startsWith: string }).startsWith) return interaction.customId.startsWith((m.name as { startsWith: string }).startsWith);
            if ((m.name as { endsWith: string }).endsWith) return interaction.customId.endsWith((m.name as { endsWith: string }).endsWith);
            if ((m.name as { includes: string }).includes) return interaction.customId.includes((m.name as { includes: string }).includes);

            return false;
        });

        if (!modal) return;

        const modalName = typeof modal.name === "string" ?
            modal.name :
            Object.values(modal.name)[0];

        let memberRoles = interaction.member?.roles;
        if (memberRoles && !Array.isArray(memberRoles)) memberRoles = memberRoles?.cache.map(role => role.id);

        const hasPermission = verifyInteractionPermissions({
            memberRoles: memberRoles as string[],
            interactionCustomId: modalName,
            interactionType: "modals",
            config
        });

        if (!hasPermission) {
            await interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true
            });
            return;
        }

        let {ephemeral} = modal;

        if (
            config.force_ephemeral_response &&
            !modal.skipInternalUsageCheck &&
            !config.force_ephemeral_response.excluded_channels?.includes(interaction.channelId as string) &&
            !config.force_ephemeral_response.excluded_categories?.includes((interaction.channel as TextChannel).parentId as string)
        ) ephemeral = true;

        await interaction.deferReply({ephemeral});

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await command.execute(interaction, this.client);
        } catch (err) {
            console.log(`Failed to execute modal: ${modal.name}`);
            console.error(err);
            return;
        }

        if (
            config.logging?.command_usage?.enabled &&
            config.logging.command_usage.channel_id &&
            !config.logging.excluded_channels?.includes(interaction.channelId as string) &&
            !config.logging.excluded_categories?.includes((interaction.channel as TextChannel).parentId as string)
        ) {
            const commandUseLogsChannel = await interaction.guild?.channels.fetch(config.logging.command_usage.channel_id) as TextChannel;
            await createLog({
                action: "Interaction Used",
                author: interaction.user,
                color: config.colors?.default,
                logsChannel: commandUseLogsChannel,
                icon: "InteractionIcon",
                content: `Modal \`${modalName}\` used by ${interaction.user} (\`${interaction.user.id}\`)`,
                fields: [{
                    name: "Channel",
                    value: `${interaction.channel} (\`#${(interaction.channel as TextChannel).name}\`)`
                }]
            });
        }
    }
}