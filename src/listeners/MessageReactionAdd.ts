import { Events, GuildTextBasedChannel, MessageReaction, User } from "discord.js";
import { muteMember, purgeMessages } from "../utils/ModerationUtils";
import { RolePermission } from "../utils/Types";

import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";

export default class MessageReactionAddEventListener extends EventListener {
    constructor() {
        super(Events.MessageReactionAdd);
    }

    async execute(reaction: MessageReaction, user: User): Promise<void> {
        const { emoji, message } = reaction;

        if (user.bot || !message.guild) return;
        if (reaction.partial) await reaction.fetch();

        const config = ClientManager.config(reaction.message.guildId!)!;
        const member = await message.guild.members.fetch(user.id);

        if (!config.isGuildStaff(member)) return;

        const emojiId = emoji.id ?? emoji.name ?? "N/A";

        /* Quick mutes - 30 minutes and 1 hour */
        if (config.emojis.quickMute30?.includes(emojiId) || config.emojis.quickMute60?.includes(emojiId)) {
            if (!message.member) return;

            let muteDuration = "30m";
            let emojiName = "quickMute30";

            if (config.emojis.quickMute60?.includes(emojiId)) {
                muteDuration = "60m";
                emojiName = "quickMute60";
            }

            if (!config.actionAllowed(member, {
                permission: RolePermission.Reaction,
                requiredValue: emojiName
            })) return;

            const reason = message.content;
            const res = await muteMember(message.member, {
                moderator: user,
                duration: muteDuration,
                config,
                reason
            });

            const confirmationChannelId = config.channels.staffCommands;
            if (!confirmationChannelId) return;

            const confirmationChannel = await message.guild.channels.fetch(confirmationChannelId) as GuildTextBasedChannel;
            if (!confirmationChannel) return;

            await reaction.remove();

            /* The result is the mute's expiration timestamp */
            if (typeof res === "number") {
                await Promise.all([
                    confirmationChannel.send(`${config.emojis.success} **${user.tag}** has successfully muted **${message.author?.tag}** until <t:${res}:F> | Expires <t:${res}:R> (\`${reason}\`)`),
                    message.delete().catch(() => null)
                ]);
                return;
            }

            /* The result is an error message */
            await confirmationChannel.send(`${config.emojis.error} ${user} ${res}`);
        }

        if (config.emojis.purgeMessages?.includes(emojiId)) {
            const { success, error } = config.emojis;

            const confirmationChannelId = config.channels.staffCommands;
            if (!confirmationChannelId) return;

            const confirmationChannel = await message.guild.channels.fetch(confirmationChannelId) as GuildTextBasedChannel;
            if (!confirmationChannel) return;

            await reaction.remove();

            try {
                const purgedMessages = await purgeMessages({
                    channel: reaction.message.channel as GuildTextBasedChannel,
                    amount: 100,
                    authorId: reaction.message.author?.id
                });

                if (!purgedMessages) {
                    await confirmationChannel.send(`${error} ${user} There are no messages to purge.`);
                    return;
                }

                await confirmationChannel.send(`${success} ${user} Successfully purged \`${purgedMessages}\` messages by **${reaction.message.author?.tag}**.`);
            } catch {
                await confirmationChannel.send(`${error} ${user} Failed to purge messages.`);
            }
        }
    }
}