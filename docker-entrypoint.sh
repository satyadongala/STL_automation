#!/bin/sh
set -e
mkdir -p /data reports/html reports/allure-results reports/allure temp_tests public
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"

# Virtual display for headed Playwright in Docker (no physical monitor)
if [ -z "$DISPLAY" ] && command -v Xvfb >/dev/null 2>&1; then
  echo "[SYS] Starting Xvfb :99 for headed UI tests..."
  Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
  export DISPLAY=:99
fi

exec ./start.sh
