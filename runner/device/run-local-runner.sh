#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 ]]; then
  printf '%s\n' "Usage: $0 SERVER_URL RUNNER_KEY RUNNER_TOKEN [--once]" >&2
  exit 2
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
server_url="$1"
runner_key="$2"
runner_token="$3"
once_argument="${4:-}"

if [[ -n "${once_argument}" && "${once_argument}" != "--once" ]]; then
  printf '%s\n' "The optional fourth argument must be --once." >&2
  exit 2
fi

if ! docker image inspect agenthub-runner-ts:5.7.3 >/dev/null 2>&1; then
  printf '%s\n' "Missing TypeScript image. Run ./runner/device/build-typescript-image.sh first." >&2
  exit 1
fi

command=(node "${repository_root}/runner/local-runner.mjs" --server "${server_url}" --runner "${runner_key}" --token "${runner_token}")
if [[ "${once_argument}" == "--once" ]]; then
  command+=(--once)
fi

exec "${command[@]}"
