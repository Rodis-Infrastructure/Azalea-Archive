BEGIN EXCLUSIVE;

CREATE TABLE IF NOT EXISTS messages
(
	id        BIGINT    NOT NULL PRIMARY KEY,
	authorId  BIGINT    NOT NULL,
	channelId BIGINT    NOT NULL,
	guildId   BIGINT    NOT NULL,
	createdAt TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS infractions
(
	id              INTEGER   NOT NULL PRIMARY KEY AUTOINCREMENT,
	executorId      BIGINT    NOT NULL,
	targetId        BIGINT    NOT NULL,
	createdAt       TIMESTAMP NOT NULL DEFAULT (STRFTIME('%s', 'now')),
	type            TINYINT   NOT NULL,
	requestAuthorId BIGINT,
	updatedBy       BIGINT,
	deletedBy       BIGINT,
	expiresAt       TIMESTAMP,
	deletedAt       TIMESTAMP,
	updatedAt       TIMESTAMP,
	flag            TINYINT,
	reason          TEXT
);

COMMIT;