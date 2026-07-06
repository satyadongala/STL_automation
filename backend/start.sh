#!/bin/sh
set -e
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
mkdir -p /data reports/html reports/allure

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
