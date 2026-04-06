#!/usr/bin/env bash

set -euo pipefail

bash ci/test.sh
docker build --pull -t selenwright-ui:ci .
