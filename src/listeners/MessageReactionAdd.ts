import { Events, GuildTextBasedChannel, MessageReaction, User } from "discord.js";
import { muteMember, purgeMessages, validateModerationAction } from "../utils/ModerationUtils";
import { RolePermission } from "../utils/Types";

import EventListener from "../handlers/listeners/EventListener";
import ClientManager from "../Client";
import { formatTimestamp } from "../utils";

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

        const emojiId = emoji.id ?? emoji.name ?? "N/A";
        const { emojis } = config;

        /* Quick mutes - 30 minutes and 1 hour */
        if (emojis.quickMute30?.includes(emojiId) || emojis.quickMute60?.includes(emojiId)) {
            if (!message.member) return;

            let muteDuration = "30m";
            let emojiName = "quickMute30";

            if (emojis.quickMute60?.includes(emojiId)) {
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

            /* The result is the mute's expiration timestamp */
            if (typeof res === "number") {
                await Promise.all([
                    config.sendConfirmation({
                        guild: message.guild,
                        message: `quick muted **${message.author?.tag}** until ${formatTimestamp(res, "F")} | Expires ${formatTimestamp(res, "R")}`,
                        authorId: user.id,
                        reason
                    }),
                    message.delete().catch(() => null)
                ]);

                return;
            }

            /* The result is an error message */
            await Promise.all([
                reaction.remove(),
                config.sendConfirmation({
                    guild: message.guild,
                    message: `${emojis.error} ${user} ${res}`,
                    full: true
                })
            ]);

            return;
        }

        if (emojis.purgeMessages?.includes(emojiId)) {
            if (!config.actionAllowed(member, {
                permission: RolePermission.Reaction,
                requiredValue: "purgeMessages"
            })) return;

            if (message.member) {
                const notModerateableReason = validateModerationAction({
                    config,
                    moderatorId: user.id,
                    offender: message.member
                });

                if (notModerateableReason) {
                    await config.sendConfirmation({
                        guild: message.guild,
                        message: `${emojis.error} ${user} ${notModerateableReason}`,
                        full: true
                    });

                    return;
                }
            }

            await Promise.all([
                reaction.remove(),
                purgeMessages({
                    channel: reaction.message.channel as GuildTextBasedChannel,
                    amount: 100,
                    authorId: reaction.message.author?.id,
                    moderatorId: user.id
                })
            ]).catch(() => null);
        }
    }
}