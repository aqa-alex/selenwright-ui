#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <tag>"
  exit 1
fi

TAG="$1"

IMAGE="selenwright/selenwright-ui"

if [[ -z "${DOCKERHUB_USERNAME:-}" || -z "${DOCKERHUB_TOKEN:-}" ]]; then
  echo "DOCKERHUB_USERNAME and DOCKERHUB_TOKEN are required"
  exit 1
fi

docker build --pull -t "$IMAGE" .
docker tag "$IMAGE" "$IMAGE:$TAG"
printf '%s' "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin
docker push "$IMAGE"
docker push "$IMAGE:$TAG"
