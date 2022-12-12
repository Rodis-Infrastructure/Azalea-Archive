import {Collection, GuildMember, StringSelectMenuInteraction, TextChannel, Client} from "discord.js";
import {hasInteractionPermission} from "../../../utils/RestrictionUtils";
import {InteractionResponseType} from "../../../utils/Types";
import {sendLog} from "../../../utils/LoggingUtils";
import {globalGuildConfigs} from "../../../Client";
import {readdir} from "node:fs/promises";
import {join} from "node:path";

import SelectMenu from "./SelectMenu";

export default class SelectMenuHandler {
    client: Client;
    list: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, SelectMenu>;

    constructor(client: Client) {
        this.client = client;
        this.list = new Collection();
    }

    public async load() {
        let files = await readdir(join(__dirname, "../../../interactions/select_menus"))
        files = files.filter(file => file.endsWith(".js"));

        for (const file of files) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const select_menu = require(join(__dirname, "../../../interactions/select_menus", file)).default;
            await this.register(new select_menu(this.client));
        }
    }

    public async register(select_menu: SelectMenu) {
        this.list.set(select_menu.name, select_menu);
    }

    public async handle(interaction: StringSelectMenuInteraction) {
        const config = globalGuildConfigs.get(interaction.guildId as string);

        if (!config) {
            await interaction.reply({
                content: "Guild not configured.",
                ephemeral: true
            });
            return;
        }

        const selectMenu = this.list.find(s => {
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

        let memberRoles = interaction.member?.roles;
        if (memberRoles && !Array.isArray(memberRoles)) memberRoles = memberRoles?.cache.map(role => role.id);

        const hasPermission = hasInteractionPermission({
            memberRoles: memberRoles as string[],
            interactionCustomId: selectMenuName,
            interactionType: "selectMenus",
            config
        });

        if (!hasPermission) {
            const requiredRoles = Object.keys(config.roles || {})
                .filter(role => config.roles?.[role].selectMenus?.includes(selectMenuName));

            await interaction.reply({
                content: `You do not have permission to use this command, you must have one of the following roles: \`${requiredRoles.join("` `") ?? "N/A"}\``,
                ephemeral: true
            });
            return;
        }


        let ResponseType = selectMenu.defer;
        if (
            config.forceEphemeralResponse &&
            !selectMenu.skipInternalUsageCheck &&
            !config.forceEphemeralResponse.excludedChannels?.includes(interaction.channelId as string) &&
            !config.forceEphemeralResponse.excludedCategories?.includes((interaction.channel as TextChannel).parentId as string)
        ) ResponseType = InteractionResponseType.EphemeralDefer;

        switch (ResponseType) {
            case InteractionResponseType.Defer: {
                await interaction.deferReply();
                break;
            }

            case InteractionResponseType.EphemeralDefer: {
                await interaction.deferReply({ephemeral: true});
            }
        }

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await command.execute(interaction, this.client);
        } catch (err) {
            console.log(`Failed to execute select menu: ${selectMenuName}`);
            console.error(err);
            return;
        }

        if (
            config.logging?.interactionUsage?.isEnabled &&
            config.logging.interactionUsage.channelId &&
            !config.logging.excludedChannels?.includes(interaction.channelId) &&
            !config.logging.excludedCategories?.includes((interaction.channel as TextChannel).parentId as string)
        ) {
            const commandUseLogsChannel = await interaction.guild?.channels.fetch(config.logging.interactionUsage.channelId) as TextChannel;
            await sendLog({
                action: "Interaction Used",
                author: interaction.user,
                embedColor: config.logging.interactionUsage.embedColor ?? config.colors?.embedDefault,
                logsChannel: commandUseLogsChannel,
                icon: "InteractionIcon",
                content: `Select Menu \`${selectMenuName}\` used by ${interaction.user} (\`${interaction.user.id}\`)`,
                fields: [{
                    name: "Channel",
                    value: `${interaction.channel} (\`#${(interaction.channel as TextChannel).name}\`)`
                }]
            });
        }
    }
}