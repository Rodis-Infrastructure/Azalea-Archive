import {Collection, GuildMember, ModalSubmitInteraction, TextChannel} from "discord.js";
import RestrictionUtils, {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {readdirSync} from "fs";
import {join} from "path";

import Properties from "../../../utils/Properties";
import LogsUtils from "../../../utils/LogsUtils";
import Bot from "../../../Bot";
import Modal from "./Modal";


export default class CommandHandler {
    client: Bot;
    modals: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, Modal>;

    constructor(client: Bot) {
        this.client = client;
        this.modals = new Collection();
    }

    public async load() {
        const files = readdirSync(join(__dirname, "../../../interactions/modals"))
            .filter(file => file.endsWith(".js"));

        for (const file of files) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const modal = require(join(__dirname, "../../../interactions/modals", file)).default;
            new modal(this.client);
        }
    }

    public async register(modal: Modal) {
        this.modals.set(modal.name, modal);
    }

    public async handle(interaction: ModalSubmitInteraction) {
        const modal = this.modals.find(m => {
            if (typeof m.name === "string") return m.name === interaction.customId;

            if ((m.name as { startsWith: string }).startsWith) return interaction.customId.startsWith((m.name as { startsWith: string }).startsWith);
            if ((m.name as { endsWith: string }).endsWith) return interaction.customId.endsWith((m.name as { endsWith: string }).endsWith);
            if ((m.name as { includes: string }).includes) return interaction.customId.includes((m.name as { includes: string }).includes);

            return false;
        });

        if (!modal) return;
        await interaction.deferReply({ephemeral: modal.ephemeral});

        if (!await RestrictionUtils.verifyAccess(modal.restriction, interaction.member as GuildMember)) {
            await interaction.editReply({
                content:
                `You are **below** the required restriction level for this modal: \`${RestrictionLevel[modal.restriction]}\`\n`
                + `Your restriction level: \`${RestrictionUtils.getRestrictionLabel(interaction.member as GuildMember)}\``,
            });
            return;
        }

        try {
            if (!Properties.noLogsChannels.includes(interaction.channelId as string)) {
                const commandUseLogsChannel = await interaction.guild?.channels.fetch(Properties.channels.commandUseLogs) as TextChannel;
                await LogsUtils.log({
                    action: "Modal Usage",
                    author: interaction.user,
                    logsChannel: commandUseLogsChannel,
                    fields: [{
                        name: "Modal ID",
                        value: `\`${interaction.customId}\``
                    }]
                });
            }

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await modal.execute(interaction, this.client);
        } catch (err) {
            console.log(`Failed to execute modal: ${modal.name}`);
            console.error(err);
        }
    }
}