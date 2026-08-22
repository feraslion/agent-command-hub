#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_runner="${repository_root}/runner/device/run-compose-runner.sh"
mode="${1:-heartbeat}"

case "${mode}" in
  heartbeat)
    "${compose_runner}" run --rm agenthub-runner --check-config
    "${compose_runner}" run --rm agenthub-runner --once
    printf '%s\n' "Heartbeat check completed. Confirm the Runner card shows a recent heartbeat in Agent Command Hub."
    ;;
  execution)
    "${compose_runner}" run --rm agenthub-runner --once
    printf '%s\n' "Execution poll completed. Inspect Runtime for the approved request result, exit code, and redacted output."
    ;;
  *)
    printf '%s\n' "Usage: $0 [heartbeat|execution]" >&2
    exit 2
    ;;
esac
