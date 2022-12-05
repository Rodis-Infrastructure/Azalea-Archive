import {GuildMember, PermissionFlagsBits} from "discord.js";
import Properties from "./Properties";

export enum RestrictionLevel {
    Public = 0,
    TrialStage1 = 1,
    TrialStage2 = 2,
    Moderator = 3,
    SeniorModerator = 4,
    Manager = 5
}

export default class RestrictionUtils {
    public static getRestrictionLabel(member: GuildMember): string {
        if (this.isManager(member)) return "Manager";
        if (this.isSeniorModerator(member)) return "Senior Moderator";
        if (this.isModerator(member)) return "Moderator";
        if (this.isTrialStage2(member)) return "Trial Stage 1";
        if (this.isTrialStage1(member)) return "Trial Stage 2";

        return "Public";
    }

    public static getRestrictionLevel(member: GuildMember): RestrictionLevel {
        if (this.isManager(member)) return RestrictionLevel.Manager;
        if (this.isSeniorModerator(member)) return RestrictionLevel.SeniorModerator;
        if (this.isModerator(member)) return RestrictionLevel.Moderator;
        if (this.isTrialStage2(member)) return RestrictionLevel.TrialStage1;
        if (this.isTrialStage1(member)) return RestrictionLevel.TrialStage2;

        return RestrictionLevel.Public;
    }

    public static async verifyAccess(level: RestrictionLevel, member: GuildMember): Promise<boolean> {
        switch (level) {
            case RestrictionLevel.Public: return true;
            case RestrictionLevel.TrialStage1: return this.isTrialStage1(member);
            case RestrictionLevel.TrialStage2: return this.isTrialStage2(member);
            case RestrictionLevel.Moderator: return this.isModerator(member);
            case RestrictionLevel.SeniorModerator: return this.isSeniorModerator(member);
            case RestrictionLevel.Manager: return this.isManager(member);
            default: return false;
        }
    }

    public static isStaff(member: GuildMember): boolean {
        return member.roles.cache.has(Properties.roles.trialModerator) || this.isModerator(member);
    }

    public static isTrialStage1(member: GuildMember): boolean {
        return member.roles.cache.has(Properties.roles.trialStageOne) || this.isTrialStage2(member);
    }

    public static isTrialStage2(member: GuildMember): boolean {
        return member.roles.cache.has(Properties.roles.trialStageTwo) || this.isModerator(member);
    }

    public static isModerator(member: GuildMember): boolean {
        return member.roles.cache.has(Properties.roles.moderator) || this.isSeniorModerator(member);
    }

    public static isSeniorModerator(member: GuildMember): boolean {
        return member.roles.cache.has(Properties.roles.seniorModerator) || this.isManager(member);
    }

    public static isManager(member: GuildMember): boolean {
        return member.roles.cache.has(Properties.roles.manager);
    }
}