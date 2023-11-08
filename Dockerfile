ARG BUN_IMAGE=1.0.7-alpine

FROM oven/bun:${BUN_IMAGE}

WORKDIR /usr/src/azalea

ENV DB_PATH=db/${DB_PATH:-db.sqlite}

COPY . .

RUN apk update && \
    apk upgrade && \
    apk add --no-cache sqlite && \
    # Create database directory
    mkdir -p data && \
    # Install dependencies
    bun install && \
    # Clean up
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/* && \
    rm -rf /var/tmp/* && \
    rm -rf /var/cache/apt/archives/* && \
    rm -rf /var/lib/docker/tmp/*

# Initiate database and start the bot
CMD bun run db:init && bun start