import { GuildMember } from "discord.js";
import Config from "./Config";

export function isGuildStaff(config: Config | undefined, member: GuildMember): boolean {
    return config?.guildStaffRoles().some(roleId => member.roles.cache.has(roleId)) ?? false;
}
