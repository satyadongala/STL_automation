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
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      [ -f "$XVFB_LOCK" ] && break
      sleep 0.2
    done
  fi
  export DISPLAY="${XVFB_DISPLAY}"
fi

# ── Live browser view (noVNC) — watch Chrome in your web browser ───────────
# Set VNC_ENABLED=0 to disable. Expose port VNC_PORT (default 6080) in Coolify.
if [ "${VNC_ENABLED:-1}" = "1" ] && [ -n "$DISPLAY" ] && command -v x11vnc >/dev/null 2>&1; then
  VNC_PORT="${VNC_PORT:-6080}"
  echo "[SYS] Starting live browser view (noVNC on port ${VNC_PORT})..."
  if [ -n "$VNC_PASSWORD" ]; then
    x11vnc -storepasswd "$VNC_PASSWORD" /tmp/x11vnc.pass 2>/dev/null || true
    x11vnc -display "$DISPLAY" -forever -shared -rfbauth /tmp/x11vnc.pass -rfbport 5900 -bg -o /tmp/x11vnc.log
  else
    x11vnc -display "$DISPLAY" -forever -shared -rfbport 5900 -nopw -bg -o /tmp/x11vnc.log
  fi
  if command -v websockify >/dev/null 2>&1; then
    websockify -D --web=/usr/share/novnc "${VNC_PORT}" localhost:5900
  fi
fi

exec ./start.sh
