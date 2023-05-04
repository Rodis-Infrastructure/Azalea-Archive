import ClientManager from "../../../Client";
import Button from "./Button";

import { InteractionResponseType, LoggingEvent, RolePermission } from "../../../utils/Types";
import { ButtonInteraction, Collection, EmbedBuilder, GuildMember, GuildTextBasedChannel } from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sendLog } from "../../../utils/LoggingUtils";

export default class ButtonHandler {
    buttons: Collection<string | { startsWith: string } | { endsWith: string } | { includes: string }, Button>;

    constructor() {
        this.buttons = new Collection();
    }

    public async load() {
        const files = await readdir(join(__dirname, "../../../interactions/buttons"));

        for (const file of files) {
            const button = (await import(join(__dirname, "../../../interactions/buttons", file))).default;
            this.register(new button());
        }
    }

    public register(button: Button) {
        this.buttons.set(button.data.name, button);
    }

    public async handle(interaction: ButtonInteraction) {
        const config = ClientManager.config(interaction.guildId!);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const button = this.buttons.find(btn => {
            const { name } = btn.data;
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

        if (!button) return;
        const { name, defer } = button.data;

        const buttonName = typeof name === "string" ?
            name :
            Object.values(name)[0];

        if (!config.actionAllowed(interaction.member as GuildMember, {
            property: RolePermission.Button,
            value: buttonName
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
            await button.execute(interaction, config);
        } catch (err) {
            console.log(`Failed to execute button: ${buttonName}`);
            console.error(err);
            return;
        }

        const log = new EmbedBuilder()
            .setColor(0x2e3136)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`Button \`${buttonName}\` used by ${interaction.user}`)
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