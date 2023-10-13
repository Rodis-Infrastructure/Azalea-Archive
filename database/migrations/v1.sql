BEGIN EXCLUSIVE;

CREATE TABLE IF NOT EXISTS messages
(
    message_id   TEXT      NOT NULL PRIMARY KEY,
    author_id    TEXT      NOT NULL,
    channel_id   TEXT      NOT NULL,
    guild_id     TEXT      NOT NULL,
    created_at   TIMESTAMP NOT NULL,
    sticker_id   TEXT,
    content      TEXT,
    reference_id TEXT,
    category_id  TEXT,
    deleted      TINYINT
);

CREATE INDEX IF NOT EXISTS idx_created_at ON messages (created_at);
CREATE INDEX IF NOT EXISTS idx_channel_messages ON messages (message_id, channel_id, guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS infractions
(
    infraction_id     INTEGER   NOT NULL PRIMARY KEY AUTOINCREMENT,
    guild_id          TEXT      NOT NULL,
    executor_id       TEXT      NOT NULL,
    target_id         TEXT      NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT (STRFTIME('%s', 'now')),
    action            TINYINT   NOT NULL,
    request_author_id TEXT,
    updated_by        TEXT,
    archived_by       TEXT,
    expires_at        TIMESTAMP,
    archived_at       TIMESTAMP,
    updated_at        TIMESTAMP,
    flag              TINYINT,
    reason            TEXT CHECK (length(reason) <= 1024)
);

CREATE INDEX IF NOT EXISTS idx_latest_user_infraction_by_type
    ON infractions (target_id, guild_id, action, infraction_id DESC);

CREATE INDEX IF NOT EXISTS idx_user_infractions_descending
    ON infractions (target_id, guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_infraction
    ON infractions (infraction_id, guild_id);

COMMIT;