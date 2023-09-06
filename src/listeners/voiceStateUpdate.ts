import { Colors, EmbedBuilder, Events, GuildTextBasedChannel, VoiceState } from "discord.js";
import { LoggingEvent } from "../types/config";
import { sendLog } from "../utils/logging";

import EventListener from "../handlers/listeners/eventListener";

export default class VoiceStateUpdateEventListener extends EventListener {
    constructor() {
        super(Events.VoiceStateUpdate);
    }

    async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
        if (oldState.channelId === newState.channelId) return;

        let icon!: string;
        const member = newState.member;
        const log = new EmbedBuilder()
            .setFields({ name: "User", value: `${member} (\`${member?.id}\`)` })
            .setTimestamp();

        if (!oldState.channelId && newState.channelId) {
            icon = "voiceJoin.png";

            log.setColor(Colors.Green);
            log.setAuthor({ name: "Voice Join" });
            log.addFields({ name: "Channel", value: `${newState.channel} (\`${newState.channel?.name}\`)` });
        } else if (oldState.channelId && !newState.channelId) {
            icon = "voiceLeave.png";

            log.setColor(Colors.Red);
            log.setAuthor({ name: "Voice Leave" });
            log.addFields({ name: "Channel", value: `${oldState.channel} (\`${oldState.channel?.name}\`)` });
        } else {
            icon = "voiceMove.png";

            log.setColor(Colors.Yellow);
            log.setAuthor({ name: "Voice Move", iconURL: `attachment://${icon}` });
            log.addFields([
                {
                    name: "Old Channel",
                    value: `${oldState.channel} (\`${oldState.channel?.name}\`)`
                },
                {
                    name: "New Channel",
                    value: `${newState.channel} (\`${newState.channel?.name}\`)`
                }
            ]);
        }

        log.data.author!.icon_url = `attachment://${icon}`;

        await sendLog({
            event: LoggingEvent.Voice,
            channel: (newState.channel || oldState.channel) as GuildTextBasedChannel,
            options: {
                embeds: [log],
                files: [{
                    attachment: `./icons/${icon}`,
                    name: icon
                }]
            }
        });
    }
}