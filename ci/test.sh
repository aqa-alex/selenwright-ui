#!/usr/bin/env bash

set -euo pipefail

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install --no-audit --no-fund
fi

npm run check
