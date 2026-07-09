# Coolify: set Build Pack → Dockerfile (not Nixpacks). Port 5001. Mount /data for SQLite.
# Playwright image tag MUST match @playwright/test in backend/package.json exactly.
# ── Stage 1: build frontend ──────────────────────────────────────────────────
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Stage 2: production image (Playwright for UI tests) ──────────────────────
FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /app

# Browsers + OS libs ship with the image; npm package version must match the tag above.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npx prisma generate && npm run build

COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=5001
ENV DATABASE_URL=file:/data/dev.db
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# ponytail: skip apt novnc (pulls 70+ pkgs + interactive tzdata) — fetch noVNC static files instead
# xvfb already in Playwright image; x11vnc + websockify + Java for live view + Allure
RUN apt-get update && apt-get install -y --no-install-recommends \
    x11vnc python3-websockify openjdk-17-jre-headless ca-certificates curl \
    && curl -fsSL https://github.com/novnc/noVNC/archive/refs/tags/v1.4.0.tar.gz \
    | tar -xz -C /usr/share \
    && mv /usr/share/noVNC-1.4.0 /usr/share/novnc \
    && ln -sf /usr/share/novnc/vnc.html /usr/share/novnc/index.html \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 5001

COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY backend/start.sh ./start.sh
RUN chmod +x /docker-entrypoint.sh ./start.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
