#!/usr/bin/env bash

set -euo pipefail

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install --no-audit --no-fund
fi

npx playwright install --with-deps chromium

npm run build

# lint + typecheck + unit
node scripts/check.mjs
npm run typecheck
npm run test:unit

# e2e: functional tests (must pass)
npx playwright test --grep-invert "baseline screenshot"

# e2e: visual regression
# Playwright baselines are platform-specific (*-chromium-linux.png).
# Generate them on first CI run; compare on subsequent runs.
snapshot_dir="tests/e2e/visual.spec.js-snapshots"
if compgen -G "${snapshot_dir}/*-chromium-linux.png" > /dev/null 2>&1; then
  npx playwright test tests/e2e/visual.spec.js
else
  echo "Linux visual baselines missing — generating with --update-snapshots"
  npx playwright test tests/e2e/visual.spec.js --update-snapshots
fi
