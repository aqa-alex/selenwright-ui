#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <tag>"
  exit 1
fi

TAG="$1"

if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  echo "GITHUB_REPOSITORY is required"
  exit 1
fi

if [[ -z "${DOCKER_USERNAME:-}" || -z "${DOCKER_PASSWORD:-}" ]]; then
  echo "DOCKER_USERNAME and DOCKER_PASSWORD are required"
  exit 1
fi

docker build --pull -t "$GITHUB_REPOSITORY" .
docker tag "$GITHUB_REPOSITORY" "$GITHUB_REPOSITORY:$TAG"
docker login -u="$DOCKER_USERNAME" -p="$DOCKER_PASSWORD"
docker push "$GITHUB_REPOSITORY"
docker push "$GITHUB_REPOSITORY:$TAG"
