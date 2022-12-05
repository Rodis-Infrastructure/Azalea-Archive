import {Collection, GuildMember, StringSelectMenuInteraction, TextChannel} from "discord.js";
import RestrictionUtils, {RestrictionLevel} from "../../../utils/RestrictionUtils";
import {ResponseType} from "../../../utils/Properties";
import {readdirSync} from "fs";
import {join} from "path";

import Properties from "../../../utils/Properties";
import LogsUtils from "../../../utils/LogsUtils";
import SelectMenu from "./SelectMenu";
import Bot from "../../../Bot";

export default class CommandHandler {
    client: Bot;
    select_menus: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, SelectMenu>;

    constructor(client: Bot) {
        this.client = client;
        this.select_menus = new Collection();
    }

    public async load() {
        const files = readdirSync(join(__dirname, "../../../interactions/select_menus"))
            .filter(file => file.endsWith(".js"));

        for (const file of files) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const select_menu = require(join(__dirname, "../../../interactions/select_menus", file)).default;
            new select_menu(this.client);
        }
    }

    public async register(select_menu: SelectMenu) {
        this.select_menus.set(select_menu.name, select_menu);
    }

    public async handle(interaction: StringSelectMenuInteraction) {
        const selectMenu = this.select_menus.find(s => {
            if (typeof s.name === "string") return s.name === interaction.customId;

            if ((s.name as { startsWith: string }).startsWith) return interaction.customId.startsWith((s.name as { startsWith: string }).startsWith);
            if ((s.name as { endsWith: string }).endsWith) return interaction.customId.endsWith((s.name as { endsWith: string }).endsWith);
            if ((s.name as { includes: string }).includes) return interaction.customId.includes((s.name as { includes: string }).includes);

            return false;
        });

        if (!selectMenu) return;

        const selectMenuName = typeof selectMenu.name === "string" ?
            selectMenu.name :
            Object.values(selectMenu.name)[0];

        switch (selectMenu.defer) {
            case ResponseType.Defer: {
                await interaction.deferReply();
                break;
            }

            case ResponseType.EphemeralDefer: {
                await interaction.deferReply({ephemeral: true});
                break;
            }
        }

        if (!await RestrictionUtils.verifyAccess(selectMenu.restriction, interaction.member as GuildMember)) {
            await interaction.editReply({
                content:
                    `You are **below** the required restriction level for this select menu: \`${RestrictionLevel[selectMenu.restriction]}\`\n`
                    + `Your restriction level: \`${RestrictionUtils.getRestrictionLabel(interaction.member as GuildMember)}\``,
            });
            return;
        }

        try {
            if (!Properties.noLogsChannels.includes(interaction.channelId)) {
                const commandUseLogsChannel = await interaction.guild?.channels.fetch(Properties.channels.commandUseLogs) as TextChannel;
                await LogsUtils.log({
                    action: "Select Menu Usage",
                    author: interaction.user,
                    logsChannel: commandUseLogsChannel,
                    fields: [{
                        name: "Select Menu ID",
                        value: `\`${interaction.customId}\``
                    }]
                });
            }

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await selectMenu.execute(interaction, this.client);
        } catch (err) {
            console.log(`Failed to execute select menu: ${selectMenuName}`);
            console.error(err);
        }
    }
}