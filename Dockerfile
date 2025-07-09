FROM node:22-slim AS builder

WORKDIR /app

COPY . /app
COPY tsconfig.json /tsconfig.json

RUN --mount=type=cache,target=/root/.npm npm install
RUN --mount=type=cache,target=/root/.npm-production npm ci --ignore-scripts --omit-dev
RUN npm install @bitwarden/cli@2025.6.1

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS release

WORKDIR /app
USER nonroot

COPY --from=builder /app/ /app/

ENV NODE_ENV=production

CMD ["dist/index.js"]
