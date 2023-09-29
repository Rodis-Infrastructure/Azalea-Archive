import {
    AutocompleteInteraction,
    Colors,
    EmbedBuilder,
    GuildMember,
    GuildTextBasedChannel,
    Interaction
} from "discord.js";

import { AnyComponentInteraction, InteractionCustomIdFilter } from "../../types/interactions";
import { LoggingEvent, RolePermission } from "../../types/config";
import { Command, ComponentInteraction } from "./interaction";
import { sendLog } from "../../utils/logging";
import { client } from "../../client";
import { glob } from "fast-glob";

import Config from "../../utils/config";
import Cache from "../../utils/cache";
import path from "node:path";

export async function loadInteractions() {
    const files = glob.sync("./src/interactions/**/*.ts");

    for (const file of files) {
        const interaction = (await import(path.resolve(file))).default;
        registerInteraction(new interaction());
    }
}

export async function publishCommands() {
    const data = Cache.commands.map(command => command.build());

    try {
        await client.application?.commands.set(data);
        console.log(`Successfully loaded ${Cache.commands.size} commands!`);
    } catch (err) {
        console.error(err);
    }
}

export async function handleInteraction(interaction: Exclude<Interaction, AutocompleteInteraction>) {
    const config = Config.get(interaction.guildId!);

    if (!config) {
        await interaction.reply({
            content: "Failed to fetch guild configuration.",
            ephemeral: true
        });
        return;
    }

    const cachedInteraction = interaction.isCommand()
        ? Cache.commands.get(`${interaction.commandName}_${interaction.commandType}`)
        : Cache.getComponentInteraction(interaction.customId);

    if (!cachedInteraction) {
        await interaction.reply({
            content: "Interaction not found.",
            ephemeral: true
        });
        return;
    }

    const { data } = cachedInteraction;
    const customId = getCustomId(data.name);

    if (!interaction.isCommand() && !config.actionAllowed(interaction.member as GuildMember, {
        permission: RolePermission.Button,
        requiredValue: customId
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
        state: data.defer,
        skipInternalUsageCheck: data.skipInternalUsageCheck,
        ephemeral: data.ephemeral
    });

    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await cachedInteraction.execute(interaction, ephemeral, config);
    } catch (err) {
        console.log(`Failed to execute button: ${customId}`);
        console.error(err);
        return;
    }

    const log = new EmbedBuilder()
        .setColor(Colors.NotQuiteBlack)
        .setAuthor({ name: "Interaction Used", iconURL: "attachment://interaction.png" })
        .setDescription(`Button \`${customId}\` used by ${interaction.user}`)
        .setFields([{
            name: "Used In",
            value: `${usageChannel} (\`#${usageChannel.name}\`)`
        }])
        .setTimestamp();

    await sendLog({
        event: LoggingEvent.Interaction,
        channelId: usageChannel.id,
        categoryId: usageChannel.parentId,
        guildId: usageChannel.guildId,
        options: {
            embeds: [log],
            files: [{
                attachment: "./icons/interaction.png",
                name: "interaction.png"
            }]
        }
    });
}

function registerInteraction(interaction: Command | ComponentInteraction<AnyComponentInteraction>): void {
    if (interaction instanceof Command) {
        Cache.commands.set(`${interaction.data.name}_${interaction.data.type}`, interaction);
        return;
    }

    Cache.interactions.set(interaction.data.name, interaction);
}

function getCustomId(customId: InteractionCustomIdFilter): string {
    return typeof customId === "string"
        ? customId
        : Object.values(customId)[0];
}