BEGIN EXCLUSIVE;

CREATE TABLE IF NOT EXISTS messages
(
    id        TEXT      NOT NULL PRIMARY KEY,
    authorId  TEXT      NOT NULL,
    channelId TEXT      NOT NULL,
    guildId   TEXT      NOT NULL,
    createdAt TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS infractions
(
    id              INTEGER   NOT NULL PRIMARY KEY AUTOINCREMENT,
    guildId         TEXT      NOT NULL,
    executorId      TEXT      NOT NULL,
    targetId        TEXT      NOT NULL,
    createdAt       TIMESTAMP NOT NULL DEFAULT (STRFTIME('%s', 'now')),
    type            TINYINT   NOT NULL,
    requestAuthorId TEXT,
    updatedBy       TEXT,
    deletedBy       TEXT,
    expiresAt       TIMESTAMP,
    deletedAt       TIMESTAMP,
    updatedAt       TIMESTAMP,
    flag            TINYINT,
    reason          TEXT
);

COMMIT;