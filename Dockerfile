ARG BUN_IMAGE=1.0.7-alpine

FROM oven/bun:${BUN_IMAGE}

WORKDIR /usr/src/azalea

ENV DB_PATH=${DB_PATH:-db.sqlite}

COPY . .

RUN apk update && \
    apk upgrade && \
    apk add --no-cache sqlite && \
    # Initiate database
    sqlite3 ${DB_PATH} < database/migrations/init.sql && \
    # Install dependencies
    bun install && \
    # Clean up
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/* && \
    rm -rf /var/tmp/* && \
    rm -rf /var/cache/apt/archives/* && \
    rm -rf /var/lib/docker/tmp/*

CMD bun start