#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js topilmadi. https://nodejs.org dan o'rnating."
  exit 1
fi

if curl -sf "http://localhost:5198/health" >/dev/null 2>&1; then
  exit 0
fi

if [ ! -d node_modules ]; then
  npm install
fi

nohup node server.js >> hr-launcher.log 2>&1 &
disown 2>/dev/null || true
exit 0
