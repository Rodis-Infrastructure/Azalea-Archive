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

CREATE INDEX IF NOT EXISTS idx_latest_messages ON messages (channel_id, guild_id, deleted, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_latest_user_infractions
    ON infractions (target_id, guild_id, infraction_id DESC);

COMMIT;