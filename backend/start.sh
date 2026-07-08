#!/bin/sh
set -e
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
mkdir -p /data reports/html reports/allure

# ponytail: if PW npm version ≠ Docker image, runtime download lacks OS libs (libglib etc.)
node -e "
const fs = require('fs');
const { chromium } = require('@playwright/test');
process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1);
" 2>/dev/null || {
  echo "[SYS] Playwright Chromium missing — installing browser + OS dependencies..."
  npx playwright install-deps chromium
  npx playwright install chromium
}

# ponytail: SQLite file DB — db push syncs schema without migration history headaches (P3009)
case "$DATABASE_URL" in
  file:*)
    echo "[SYS] Syncing SQLite schema..."
    npx prisma db push --skip-generate
    ;;
  *)
    echo "[SYS] Running migrations..."
    npx prisma migrate deploy
    ;;
esac

exec node dist/index.js
