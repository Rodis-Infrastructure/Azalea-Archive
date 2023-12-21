import { Collection, Snowflake } from "discord.js";
import { Requests } from "./requests";
import { MessageModel } from "@database/models/message";

interface PurgedMessages {
    targetId?: Snowflake;
    executorId: Snowflake;
    messageIds: Snowflake[];
}

export interface MessageCache {
    store: Collection<Snowflake, MessageModel>;
    purged?: PurgedMessages;
    /** Key format: `{targetId}_{executorId}_{channelId}` (without brackets) */
    deletionAuditLogs: Collection<string, number>;
}

export interface MessageDeleteAuditLog {
    executorId: Snowflake;
    targetId: Snowflake;
    channelId: Snowflake;
}

export interface CachedRequest {
    targetId: Snowflake;
    requestType: Requests;
    /** The ID of an automatic mute created for a ban request, defined if `autoMuteBanRequests` is `true`. */
    muteId: number | null;
}