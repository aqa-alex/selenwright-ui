#!/usr/bin/env bash

set -euo pipefail

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install --no-audit --no-fund
fi

npx playwright install --with-deps chromium

npm run build

snapshot_dir="tests/e2e/visual.spec.js-snapshots"
if [ ! -d "$snapshot_dir" ] || [ -z "$(ls -A "$snapshot_dir" 2>/dev/null)" ]; then
  echo "Visual regression baselines not found — generating on this platform…"
  npx playwright test tests/e2e/visual.spec.js --update-snapshots
fi

npm run check
