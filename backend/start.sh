#!/bin/sh
set -e
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
mkdir -p /data reports/html reports/allure
npx prisma migrate deploy
exec node dist/index.js
