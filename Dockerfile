# --- Stage 1: Build native deps (better-sqlite3) ---
# Debian (glibc) is used for best compatibility with native modules.
FROM node:22-bookworm AS builder

WORKDIR /usr/src/app

# better-sqlite3 compiles native bindings; these are needed during install
RUN apt-get update \
	&& apt-get install -y --no-install-recommends build-essential python3 \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev


# --- Stage 2: Runtime ---
FROM node:22-bookworm-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy production node_modules compiled in builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy app source
COPY package.json package-lock.json* ./
COPY index.js ./
COPY src ./src

# SQLite lives under ./data by default (see src/constants.js)
RUN mkdir -p /usr/src/app/data \
	&& chown -R node:node /usr/src/app

# Default port is controlled by src/constants.js
EXPOSE 4009

USER node
CMD ["node", "index.js"]
