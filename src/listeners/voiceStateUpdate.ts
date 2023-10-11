import { Colors, EmbedBuilder, Events, VoiceBasedChannel, VoiceState } from "discord.js";
import { LoggingEvent } from "../types/config";
import { sendLog } from "../utils/logging";

import EventListener from "../handlers/listeners/eventListener";

export default class VoiceStateUpdateEventListener extends EventListener {
    constructor() {
        super(Events.VoiceStateUpdate);
    }

    async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
        if (oldState.channelId === newState.channelId) return;

        let logAuthorIcon!: string;

        const member = newState.member;
        const log = new EmbedBuilder()
            .setFields({ name: "User", value: `${member} (\`${member?.id}\`)` })
            .setTimestamp();

        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            logAuthorIcon = "voiceJoin.png";

            log.setColor(Colors.Green);
            log.setAuthor({ name: "Voice Join" });
            log.addFields({ name: "Channel", value: `${newState.channel} (\`${newState.channel?.name}\`)` });
        }

        // User left a voice channel
        if (oldState.channelId && !newState.channelId) {
            logAuthorIcon = "voiceLeave.png";

            log.setColor(Colors.Red);
            log.setAuthor({ name: "Voice Leave" });
            log.addFields({ name: "Channel", value: `${oldState.channel} (\`${oldState.channel?.name}\`)` });
        }

        // User moved from one voice channel to another
        if (oldState.channelId && newState.channelId) {
            logAuthorIcon = "voiceMove.png";

            log.setColor(Colors.Yellow);
            log.setAuthor({ name: "Voice Move" });
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

        log.data.author!.icon_url = `attachment://${logAuthorIcon}`;

        await sendLog({
            event: LoggingEvent.Voice,
            sourceChannel: (newState.channel || oldState.channel) as VoiceBasedChannel,
            options: {
                embeds: [log],
                files: [{
                    attachment: `./icons/${logAuthorIcon}`,
                    name: logAuthorIcon
                }]
            }
        });
    }
}