import { Collection, Snowflake } from "discord.js";
import { RequestType } from "./utils";
import { MessageModel } from "./db";

interface PurgedMessages {
    targetId?: Snowflake;
    executorId: Snowflake;
    messageIds: Snowflake[];
}

export interface MessageCache {
    store: Collection<Snowflake, MessageModel>;
    purged?: PurgedMessages;
}

export interface CachedRequest {
    targetId: Snowflake;
    requestType: RequestType;
    /** The ID of an automatic mute created for a ban request, defined if `autoMuteBanRequests` is `true`. */
    muteId: number | null;
}