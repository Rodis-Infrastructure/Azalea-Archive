BEGIN EXCLUSIVE;

CREATE TABLE IF NOT EXISTS messages
(
    messageId TEXT      NOT NULL PRIMARY KEY,
    authorId  TEXT      NOT NULL,
    channelId TEXT      NOT NULL,
    guildId   TEXT      NOT NULL,
    createdAt TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_created_at ON messages (createdAt);
CREATE INDEX IF NOT EXISTS idx_channel_messages ON messages (messageId, channelId, guildId, createdAt DESC);

CREATE TABLE IF NOT EXISTS infractions
(
    infractionId    INTEGER   NOT NULL PRIMARY KEY AUTOINCREMENT,
    guildId         TEXT      NOT NULL,
    executorId      TEXT      NOT NULL,
    targetId        TEXT      NOT NULL,
    createdAt       TIMESTAMP NOT NULL DEFAULT (STRFTIME('%s', 'now')),
    action          TINYINT   NOT NULL,
    requestAuthorId TEXT,
    updatedBy       TEXT,
    deletedBy       TEXT,
    expiresAt       TIMESTAMP,
    deletedAt       TIMESTAMP,
    updatedAt       TIMESTAMP,
    flag            TINYINT,
    reason          TEXT CHECK (length(reason) <= 1024)
);

CREATE INDEX IF NOT EXISTS idx_latest_user_infraction_by_type
    ON infractions (targetId, guildId, action, infractionId DESC);

CREATE INDEX IF NOT EXISTS idx_user_infractions_descending
    ON infractions (targetId, guildId, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_infraction
    ON infractions (infractionId, guildId);

COMMIT;