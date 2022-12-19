import {GuildConfig, StringInteractionType} from "./Types";

export function hasInteractionPermission(data: {
    memberRoles: string[],
    config: GuildConfig,
    interactionType: StringInteractionType,
    interactionCustomId: string
}): boolean {
    const {memberRoles, config, interactionType, interactionCustomId} = data;

    return memberRoles?.some(memberRoleId => {
        if (!config.roles) return;

        const roleName = Object.keys(config.roles).find(role => config.roles![role]?.roleId === memberRoleId);
        if (!roleName) return;

        return config.roles[roleName]?.[interactionType]?.includes(interactionCustomId) ||
            config.roles.everyone?.[interactionType]?.includes(interactionCustomId);
    });
}