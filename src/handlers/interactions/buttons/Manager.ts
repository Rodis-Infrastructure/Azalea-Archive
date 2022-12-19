import ClientManager from "../../../Client";
import Button from "./Button";

import {ButtonInteraction, Collection, TextChannel} from "discord.js";
import {hasInteractionPermission} from "../../../utils/PermissionUtils";
import {InteractionResponseType} from "../../../utils/Types";
import {sendLog} from "../../../utils/LoggingUtils";
import {readdir} from "node:fs/promises";
import {join} from "node:path";

export default class ButtonHandler {
    buttons: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, Button>;

    constructor() {
        this.buttons = new Collection();
    }

    public async load() {
        const files = await readdir(join(__dirname, "../../../interactions/buttons"))

        for (const file of files) {
            const button = (await import(join(__dirname, "../../../interactions/buttons", file))).default;
            await this.register(new button());
        }
    }

    public async register(button: Button) {
        this.buttons.set(button.name, button);
    }

    public async handle(interaction: ButtonInteraction) {
        const config = ClientManager.guildConfigs.get(interaction.guildId as string);

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
            const requiredRoles = Object.keys(config.roles || {})
                .filter(role => config.roles?.[role].buttons?.includes(buttonName));

            await interaction.reply({
                content: `You do not have permission to use this button, you must have one of the following roles: \`${requiredRoles.join("` `") || "N/A"}\``,
                ephemeral: true
            });
            return;
        }


        let ResponseType = button.defer;
        if (
            config.forceEphemeralResponse &&
            !button.skipInternalUsageCheck &&
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
            await button.execute(interaction);
        } catch (err) {
            console.log(`Failed to execute button: ${buttonName}`);
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
                logsChannel: commandUseLogsChannel,
                embedColor: config.logging.interactionUsage.embedColor ?? config.colors?.embedDefault,
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