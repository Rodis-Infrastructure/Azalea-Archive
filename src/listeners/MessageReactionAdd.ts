import { Events, GuildTextBasedChannel, MessageReaction, User } from "discord.js";
import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";
import { muteMember } from "../utils/ModerationUtils";
import { RolePermission } from "../utils/Types";

export default class MessageReactionAddEventListener extends EventListener {
    constructor() {
        super({
            name: Events.MessageReactionAdd,
            once: false
        });
    }

    async execute(reaction: MessageReaction, user: User): Promise<void> {
        if (reaction.partial) await reaction.fetch();
        if (user.bot) return;

        const config = ClientManager.config(reaction.message.guildId!)!;
        const member = await reaction.message.guild!.members.fetch(user.id);

        if (!config.isGuildStaff(member)) return;

        const { emoji, message } = reaction;
        const emojiName = emoji.id ?? emoji.name ?? "N/A";

        // Quick mutes
        if (config.emojis.quickMute30?.includes(emojiName) || config.emojis.quickMute60?.includes(emojiName)) {
            if (!message.member) return;

            let duration = "30m";
            let emojiType = "quickMute30";

            if (config.emojis.quickMute60?.includes(emojiName)) {
                duration = "60m";
                emojiType = "quickMute60";
            }

            if (!config.actionAllowed(member, {
                property: RolePermission.Reaction,
                value: emojiType
            })) return;

            const reason = message.content ?? undefined;
            const res = await muteMember({
                offender: message.member,
                moderator: user,
                duration,
                config,
                reason
            });

            const channelId = config.channels?.staffCommands;
            if (!channelId) return;

            const channel = await message.guild?.channels.fetch(channelId) as GuildTextBasedChannel;
            if (!channel) return;

            await reaction.remove();

            if (typeof res === "number") {
                await channel.send(`${config.emojis.success} **${user.tag}** has successfully muted **${message.author?.tag}** until <t:${res}:F> | Expires <t:${res}:R> (\`${reason}\`)`);
                await message.delete().catch(() => null);
                return;
            }

            await channel.send(`${config.emojis.error} ${user} ${res}`);
        }
    }
}