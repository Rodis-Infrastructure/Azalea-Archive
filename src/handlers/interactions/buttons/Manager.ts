import Button from "./Button";

import {ButtonInteraction, Client, Collection, TextChannel} from "discord.js";
import {hasInteractionPermission} from "../../../utils/RestrictionUtils";
import {InteractionResponseType} from "../../../utils/Types";
import {sendLog} from "../../../utils/LoggingUtils";
import {globalGuildConfigs} from "../../../Client";
import {readdir} from "node:fs/promises";
import {join} from "node:path";

export default class ButtonHandler {
    client: Client;
    buttons: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, Button>;

    constructor(client: Client) {
        this.client = client;
        this.buttons = new Collection();
    }

    public async load() {
        let files = await readdir(join(__dirname, "../../../interactions/buttons"))
        files = files.filter(file => file.endsWith(".js"));

        for (const file of files) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const button = require(join(__dirname, "../../../interactions/buttons", file)).default;
            await this.register(new button(this.client));
        }
    }

    public async register(button: Button) {
        this.buttons.set(button.name, button);
    }

    public async handle(interaction: ButtonInteraction) {
        const config = globalGuildConfigs.get(interaction.guildId as string);

        if (!config) {
            await interaction.reply({
                content: "Guild not configured.",
                ephemeral: true
            });
            return;
        }

        const button = this.buttons.find(b => {
            if (typeof b.name === "string") return b.name === interaction.customId;

            if ((b.name as { startsWith: string }).startsWith) return interaction.customId.startsWith((b.name as { startsWith: string }).startsWith);
            if ((b.name as { endsWith: string }).endsWith) return interaction.customId.endsWith((b.name as { endsWith: string }).endsWith);
            if ((b.name as { includes: string }).includes) return interaction.customId.includes((b.name as { includes: string }).includes);

            return false;
        });

        if (!button) return;

        const buttonName = typeof button.name === "string" ?
            button.name :
            Object.values(button.name)[0];

        let memberRoles = interaction.member?.roles;
        if (memberRoles && !Array.isArray(memberRoles)) memberRoles = memberRoles?.cache.map(role => role.id);

        const hasPermission = hasInteractionPermission({
            memberRoles: memberRoles as string[],
            interactionCustomId: buttonName,
            interactionType: "buttons",
            config
        });

        if (!hasPermission) {
            await interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true
            });
            return;
        }


        let ResponseType = button.defer;
        if (
            config.force_ephemeral_response &&
            !button.skipInternalUsageCheck &&
            !config.force_ephemeral_response.excluded_channels?.includes(interaction.channelId as string) &&
            !config.force_ephemeral_response.excluded_categories?.includes((interaction.channel as TextChannel).parentId as string)
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
            console.log(`Failed to execute button: ${buttonName}`);
            console.error(err);
            return;
        }

        if (
            config.logging?.command_usage?.enabled &&
            config.logging.command_usage.channel_id &&
            !config.logging.excluded_channels?.includes(interaction.channelId) &&
            !config.logging.excluded_categories?.includes((interaction.channel as TextChannel).parentId as string)
        ) {
            const commandUseLogsChannel = await interaction.guild?.channels.fetch(config.logging.command_usage.channel_id) as TextChannel;
            await sendLog({
                action: "Interaction Used",
                author: interaction.user,
                logsChannel: commandUseLogsChannel,
                color: config.colors?.default,
                icon: "InteractionIcon",
                content: `Button \`${buttonName}\` used by ${interaction.user} (\`${interaction.user.id}\`)`,
                fields: [{
                    name: "Channel",
                    value: `${interaction.channel} (\`#${(interaction.channel as TextChannel).name}\`)`
                }]
            });
        }
    }
}