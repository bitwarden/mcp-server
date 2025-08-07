FROM node:22-alpine AS builder

COPY . /app
COPY tsconfig.json /tsconfig.json

WORKDIR /app

RUN --mount=type=cache,target=/root/.npm npm install
RUN --mount=type=cache,target=/root/.npm-production npm ci --ignore-scripts --omit-dev
RUN --mount=type=cache,target=/root/.npm-production npm install @bitwarden/cli@2025.7.0

FROM node:22-alpine AS release

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

RUN npm ci --ignore-scripts --omit-dev

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD export BW_SESSION="dummy" && echo '{ "jsonrpc": "2.0", "id": "123", "method": "ping" }' | \
    ./dist/index.js | grep -q '"result": {}' || exit 1

ENTRYPOINT ["node", "dist/index.js"]
