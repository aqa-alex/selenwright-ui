#!/usr/bin/env bash

set -euo pipefail

COMPOSE_FILE="docker-compose-build.yml"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose -f "$COMPOSE_FILE")
else
  COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")
fi

"${COMPOSE_CMD[@]}" rm -f selenwright-ui || true
"${COMPOSE_CMD[@]}" up --build
