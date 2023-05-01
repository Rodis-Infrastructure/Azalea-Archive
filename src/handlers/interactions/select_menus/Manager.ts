import ClientManager from "../../../Client";

import { Collection, EmbedBuilder, GuildTextBasedChannel, StringSelectMenuInteraction } from "discord.js";
import { InteractionResponseType, LoggingEvent } from "../../../utils/Types";
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

    public register(select_menu: SelectMenu) {
        this.list.set(select_menu.name, select_menu);
    }

    public async handle(interaction: StringSelectMenuInteraction) {
        const config = ClientManager.config(interaction.guildId as string);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const selectMenu = this.list.find(s => {
            if (typeof s.name === "string") return s.name === interaction.customId;

            if ((s.name as { startsWith: string }).startsWith) {
                return interaction.customId.startsWith((s.name as {
                    startsWith: string
                }).startsWith); 
            }
            if ((s.name as { endsWith: string }).endsWith) {
                return interaction.customId.endsWith((s.name as {
                    endsWith: string
                }).endsWith); 
            }
            if ((s.name as { includes: string }).includes) {
                return interaction.customId.includes((s.name as {
                    includes: string
                }).includes); 
            }

            return false;
        });

        if (!selectMenu) return;

        const selectMenuName = typeof selectMenu.name === "string" ?
            selectMenu.name :
            Object.values(selectMenu.name)[0];

        if (!config.interactionAllowed(interaction)) {
            await interaction.reply({
                content: "You do not have permission to use this interaction",
                ephemeral: true
            });
            return;
        }

        const channel = interaction.channel as GuildTextBasedChannel;

        const responseType = config.ephemeralResponseIn(channel) ?
            InteractionResponseType.EphemeralDefer :
            selectMenu.defer;

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
            await selectMenu.execute(interaction);
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