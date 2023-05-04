import ClientManager from "../../../Client";

import { Collection, EmbedBuilder, GuildMember, GuildTextBasedChannel, StringSelectMenuInteraction } from "discord.js";
import { InteractionResponseType, LoggingEvent, RolePermission } from "../../../utils/Types";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import SelectMenu from "./SelectMenu";
import { sendLog } from "../../../utils/LoggingUtils";

export default class SelectMenuHandler {
    list: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, SelectMenu>;

    constructor() {
        this.list = new Collection();
    }

    public async load() {
        const files = await readdir(join(__dirname, "../../../interactions/select_menus"));

        for (const file of files) {
            const selectMenu = (await import(join(__dirname, "../../../interactions/select_menus", file))).default;
            this.register(new selectMenu());
        }
    }

    public register(selectMenu: SelectMenu) {
        this.list.set(selectMenu.data.name, selectMenu);
    }

    public async handle(interaction: StringSelectMenuInteraction) {
        const config = ClientManager.config(interaction.guildId!);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const selectMenu = this.list.find(sm => {
            const { name } = sm.data;
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

        if (!selectMenu) return;
        const { name, defer } = selectMenu.data;

        const selectMenuName = typeof name === "string" ?
            name :
            Object.values(name)[0];

        if (!config.actionAllowed(interaction.member as GuildMember, {
            property: RolePermission.SelectMenu,
            value: selectMenuName
        })) {
            await interaction.reply({
                content: "You do not have permission to use this interaction",
                ephemeral: true
            });
            return;
        }

        const channel = interaction.channel as GuildTextBasedChannel;

        const responseType = config.ephemeralResponseIn(channel) ?
            InteractionResponseType.EphemeralDefer :
            defer;

        switch (responseType) {
            case InteractionResponseType.Defer: {
                await interaction.deferReply();
                break;
            }

            case InteractionResponseType.EphemeralDefer: {
                await interaction.deferReply({ ephemeral: true });
            }
        }

        try {
            await selectMenu.execute(interaction, config);
        } catch (err) {
            console.log(`Failed to execute select menu: ${selectMenuName}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(0x2e3136)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`Selection \`${selectMenuName}\` used by ${interaction.user}`)
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