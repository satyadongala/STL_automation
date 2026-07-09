#!/bin/sh
# ponytail: Coolify injects PORT=3000 — must match what node listens on
curl -fsS "http://127.0.0.1:${PORT:-5001}/health" || exit 1
