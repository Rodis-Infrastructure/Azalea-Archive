import { GuildMember } from "discord.js";

export enum Requests {
    Ban = "ban",
    Mute = "mute"
}

export interface RequestValidationResult {
    target: GuildMember | null,
    reason: string
}