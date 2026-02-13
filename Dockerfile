FROM node:22-bookworm AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx nuxt build


FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
    NITRO_HOST=0.0.0.0
	HOST=0.0.0.0
    NITRO_PORT=4009
	PORT=4009

COPY --from=build /app/.output ./.output

RUN mkdir -p /app/db \
  && chown -R node:node /app

EXPOSE 4009

USER node
CMD ["node", ".output/server/index.mjs"]
