import { MinimalInfraction } from "./db";
import { InfractionFilter } from "./utils";
import { Collection } from "discord.js";

export interface Cache {
    messages: {
        store: Collection<string, CachedMessage>;
        remove: Set<string>;
        purged?: {
            targetId?: string;
            moderatorId: string;
            data: string[];
        }
    }
    activeMutes: Collection<string, number>;
    infractions: Collection<string, CachedInfractions>;
}

export interface CachedInfractions {
    messages: Collection<string, InfractionSearchResponse>;
    data: MinimalInfraction[];
    timeout?: NodeJS.Timeout;
}

export interface CachedMessage {
    authorId: string;
    channelId: string;
    guildId: string;
    createdAt: number;
}

interface InfractionSearchResponse {
    filter: InfractionFilter | null;
    authorId: string;
    page: number;
}