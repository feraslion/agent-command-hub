#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

docker build \
  -f "${repository_root}/runner/Dockerfile.typescript" \
  -t agenthub-runner-ts:5.7.3 \
  "${repository_root}/runner"

printf '%s\n' "Built agenthub-runner-ts:5.7.3 from the locked TypeScript dependencies."
