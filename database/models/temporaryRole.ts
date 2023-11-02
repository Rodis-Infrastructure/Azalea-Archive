export interface TemporaryRole {
    role_id: string;
    /** Comma-separated string of user IDs */
    users: string;
    /** Expiration of the temporary role (ms since epoch) */
    expires_at: number;
    guild_id: string;
    /** The ID of the message associated with the request */
    request_id: string;
}