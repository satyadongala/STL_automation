#!/bin/sh
set -e
mkdir -p /data reports/html reports/allure-results reports/allure temp_tests public
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"

# ── Virtual display (Xvfb) for headed Playwright in Docker ─────────────────
XVFB_DISPLAY="${XVFB_DISPLAY:-:99}"
XVFB_NUM="${XVFB_DISPLAY#:}"
XVFB_LOCK="/tmp/.X${XVFB_NUM}-lock"

if command -v Xvfb >/dev/null 2>&1; then
  if [ ! -f "$XVFB_LOCK" ]; then
    echo "[SYS] Starting Xvfb ${XVFB_DISPLAY} for headed UI tests..."
    Xvfb "${XVFB_DISPLAY}" -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
      [ -f "$XVFB_LOCK" ] && break
      sleep 0.2
    done
  fi
  if [ ! -f "$XVFB_LOCK" ]; then
    echo "[SYS] WARNING: Xvfb failed to start — headed tests will fail"
  else
    export DISPLAY="${XVFB_DISPLAY}"
    echo "[SYS] Xvfb ready (DISPLAY=${DISPLAY})"
  fi
fi

# ── Live browser view: x11vnc + websockify (proxied via app on :5001/live-browser) ──
if [ "${VNC_ENABLED:-1}" = "1" ] && [ -n "$DISPLAY" ] && command -v x11vnc >/dev/null 2>&1; then
  WEBSOCKIFY_PORT="${WEBSOCKIFY_PORT:-6080}"
  echo "[SYS] Starting VNC stack for live browser view..."

  if [ -n "$VNC_PASSWORD" ]; then
    x11vnc -storepasswd "$VNC_PASSWORD" /tmp/x11vnc.pass 2>/dev/null || true
    x11vnc -display "$DISPLAY" -forever -shared -noxdamage -rfbauth /tmp/x11vnc.pass -rfbport 5900 -bg -o /tmp/x11vnc.log
  else
    x11vnc -display "$DISPLAY" -forever -shared -noxdamage -rfbport 5900 -nopw -bg -o /tmp/x11vnc.log
  fi
  sleep 0.5

  if command -v websockify >/dev/null 2>&1; then
    # ponytail: bind localhost only — Express proxies /websockify → here
    pkill -f "websockify.*${WEBSOCKIFY_PORT}" 2>/dev/null || true
    websockify -D "127.0.0.1:${WEBSOCKIFY_PORT}" localhost:5900
    echo "[SYS] Live browser: use /live-browser/vnc.html on your app URL (port ${PORT:-5001})"
  else
    echo "[SYS] WARNING: websockify not found"
  fi
fi

exec ./start.sh
