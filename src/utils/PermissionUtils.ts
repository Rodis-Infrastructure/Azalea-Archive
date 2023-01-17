import {GuildConfig, StringInteractionType} from "./Types";

export function hasInteractionPermission(data: {
    memberRoles: string[],
    config: GuildConfig,
    interactionType: StringInteractionType,
    interactionCustomId: string
}): boolean {
    const {memberRoles, config, interactionType, interactionCustomId} = data;

    return memberRoles?.some(memberRoleId => {
        if (!config.rolePermissions) return;

        const roleName = Object.keys(config.rolePermissions).find(role => config.rolePermissions![role]?.roleId === memberRoleId);
        if (!roleName) return;

        return config.rolePermissions[roleName]?.[interactionType]?.includes(interactionCustomId) ||
            config.rolePermissions.everyone?.[interactionType]?.includes(interactionCustomId);
    });
}