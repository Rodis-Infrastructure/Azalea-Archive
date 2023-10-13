import { Snowflake } from "discord.js";

export interface MessageModel {
    message_id: Snowflake;
    author_id: Snowflake;
    channel_id: Snowflake;
    guild_id: Snowflake;
    created_at: EpochTimeStamp;
    deleted: boolean;
    reference_id: Snowflake | null;
    category_id: Snowflake | null;
    content: string | null;
    sticker_id: Snowflake | null;
}