import { GuildMember } from "discord.js";
import Config from "./Config";

export function isStaff(config: Config | undefined, member: GuildMember): boolean {
    return config?.staffRoles().some(roleId => member.roles.cache.has(roleId)) ?? false;
}
