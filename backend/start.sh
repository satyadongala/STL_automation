#!/bin/sh
set -e
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
mkdir -p /data reports/html reports/allure "${PROJECT_WORKSPACES_DIR:-/data/project_workspaces}"

# ponytail: if PW npm version ≠ Docker image, runtime download lacks OS libs (libglib etc.)
if ! node -e "
const fs = require('fs');
const { chromium } = require('@playwright/test');
process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1);
" 2>/dev/null; then
  echo "[SYS] Playwright Chromium missing — installing browser + OS dependencies..."
  npx playwright install-deps chromium || true
  npx playwright install chromium || true
fi

# ponytail: SQLite file DB — db push syncs schema without migration history headaches (P3009)
case "$DATABASE_URL" in
  file:*)
    echo "[SYS] Syncing SQLite schema..."
    npx prisma db push --skip-generate --accept-data-loss || {
      echo "[SYS] WARNING: prisma db push failed — starting anyway (check /data volume mount)"
    }
    ;;
  *)
    echo "[SYS] Running migrations..."
    npx prisma migrate deploy || {
      echo "[SYS] WARNING: prisma migrate deploy failed — starting anyway"
    }
    ;;
esac

exec node dist/index.js
