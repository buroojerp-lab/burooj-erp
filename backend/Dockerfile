# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev musl-dev

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY migrations ./migrations
COPY package.json ./

# ── Runtime ──
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    cairo-dev jpeg-dev pango-dev \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/uploads/bills /app/uploads/docs

EXPOSE 5000

CMD ["sh", "-c", "node src/utils/runMigrations.js && node src/server.js"]
