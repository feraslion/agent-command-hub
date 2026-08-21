#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config_path="${repository_root}/runner/device/.env.runner"
compose_file="${repository_root}/runner/device/docker-compose.runner.yml"
workspace_root="${repository_root}/runner/device/.runner-work"

if [[ ! -f "${config_path}" ]]; then
  printf '%s\n' "Missing Runner configuration: ${config_path}" >&2
  printf '%s\n' "Create it with ./runner/device/prepare-runner-pairing.sh, then enter the issued key and token locally." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  printf '%s\n' "Docker Compose v2 is required. Confirm Docker Desktop or Docker Engine is running on this device." >&2
  exit 1
fi

mkdir -p "${workspace_root}"
chmod 700 "${workspace_root}"

export AGENTHUB_RUNNER_HOST_WORKSPACE_ROOT="${workspace_root}"

if [[ $# -eq 0 ]]; then
  set -- up -d --build
fi

exec docker compose --env-file "${config_path}" -f "${compose_file}" "$@"
