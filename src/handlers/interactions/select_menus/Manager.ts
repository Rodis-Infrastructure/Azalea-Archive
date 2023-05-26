import {
    Collection,
    Colors,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    StringSelectMenuInteraction
} from "discord.js";

import { InteractionCustomIdFilter, InteractionResponseType, LoggingEvent, RolePermission } from "../../../utils/Types";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sendLog } from "../../../utils/LoggingUtils";
import { formatCustomId, validateCustomId } from "../../../utils";

import SelectMenu from "./SelectMenu";
import ClientManager from "../../../Client";

export default class SelectMenuHandler {
    list: Collection<InteractionCustomIdFilter, SelectMenu>;

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

        const selectMenu = validateCustomId(this.list, interaction.customId);

        if (!selectMenu) {
            await interaction.reply({
                content: "Interaction not found.",
                ephemeral: true
            });
            return;
        }

        const formattedCustomId = formatCustomId(selectMenu.data.name);

        if (!config.actionAllowed(interaction.member as GuildMember, {
            permission: RolePermission.SelectMenu,
            requiredValue: formattedCustomId
        })) {
            await interaction.reply({
                content: "You do not have permission to use this interaction",
                ephemeral: true
            });
            return;
        }

        const usageChannel = interaction.channel as GuildTextBasedChannel;
        const responseDeferralType = config.ephemeralResponseIn(usageChannel)
            ? InteractionResponseType.EphemeralDefer
            : selectMenu.data.defer;

        switch (responseDeferralType) {
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
            console.log(`Failed to execute select menu: ${formattedCustomId}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(Colors.NotQuiteBlack)
            .setAuthor({ name: "Interaction Used", iconURL: "attachment://interaction.png" })
            .setDescription(`Select menu \`${formattedCustomId}\` used by ${interaction.user}`)
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