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

if [[ -z "${DOCKERHUB_USERNAME:-}" || -z "${DOCKERHUB_TOKEN:-}" ]]; then
  echo "DOCKERHUB_USERNAME and DOCKERHUB_TOKEN are required"
  exit 1
fi

docker build --pull -t "$GITHUB_REPOSITORY" .
docker tag "$GITHUB_REPOSITORY" "$GITHUB_REPOSITORY:$TAG"
docker login -u="$DOCKERHUB_USERNAME" -p="$DOCKERHUB_TOKEN"
docker push "$GITHUB_REPOSITORY"
docker push "$GITHUB_REPOSITORY:$TAG"
