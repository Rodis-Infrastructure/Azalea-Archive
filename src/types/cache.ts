import { MessageModel, MinimalInfraction } from "./db";
import { InfractionFilter, RequestType } from "./utils";
import { Collection } from "discord.js";

export interface Cache {
    messages: {
        store: Collection<string, MessageModel>;
        purged?: {
            targetId?: string;
            moderatorId: string;
            data: string[];
        }
    }
    activeMutes: Collection<string, number>;
    infractions: Collection<string, CachedInfractions>;
    requests: Collection<string, CachedRequest>
}

export interface CachedRequest {
    targetId: string;
    requestType: RequestType;
    infractionId?: number;
}

export interface CachedInfractions {
    messages: Collection<string, InfractionSearchResponse>;
    data: MinimalInfraction[];
    timeout?: NodeJS.Timeout;
}

interface InfractionSearchResponse {
    filter: InfractionFilter | null;
    authorId: string;
    page: number;
}