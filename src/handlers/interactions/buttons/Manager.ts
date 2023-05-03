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
        this.buttons.set(button.name, button);
    }

    public async handle(interaction: ButtonInteraction) {
        const config = ClientManager.config(interaction.guildId as string);

        if (!config) {
            await interaction.reply({
                content: "Failed to fetch guild configuration.",
                ephemeral: true
            });
            return;
        }

        const button = this.buttons.find(b => {
            if (typeof b.name === "string") return b.name === interaction.customId;

            if ((b.name as { startsWith: string }).startsWith) {
                return interaction.customId.startsWith((b.name as {
                    startsWith: string
                }).startsWith);
            }
            if ((b.name as { endsWith: string }).endsWith) {
                return interaction.customId.endsWith((b.name as {
                    endsWith: string
                }).endsWith);
            }
            if ((b.name as { includes: string }).includes) {
                return interaction.customId.includes((b.name as {
                    includes: string
                }).includes);
            }

            return false;
        });

        if (!button) return;

        const buttonName = typeof button.name === "string" ?
            button.name :
            Object.values(button.name)[0];

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
            button.defer;

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
            await button.execute(interaction);
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