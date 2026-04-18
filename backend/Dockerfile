# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

COPY src ./src
COPY migrations ./migrations
COPY package.json ./

# ── Runtime ──
FROM node:20-alpine

WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/uploads/bills /app/uploads/docs

EXPOSE 5000

CMD ["sh", "-c", "node src/utils/runMigrations.js && node src/server.js"]
