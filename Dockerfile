FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./

RUN npm ci --ignore-scripts --omit-dev
RUN npm install @bitwarden/cli@2025.7.0

FROM dependencies AS builder

WORKDIR /app

COPY . .

RUN npm run build

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS release

WORKDIR /app
USER nonroot

COPY --from=builder /app/dist ./dist
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD export BW_SESSION="dummy" && echo '{ "jsonrpc": "2.0", "id": "123", "method": "ping" }' | \
    ./dist/index.js | grep -q '"result": {}' || exit 1

CMD ["dist/index.js"]
