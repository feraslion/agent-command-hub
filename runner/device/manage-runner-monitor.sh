#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_runner="${repository_root}/runner/device/run-compose-runner.sh"
action="${1:-}"

case "${action}" in
  start)
    exec "${compose_runner}" --profile monitor up -d --build agenthub-runner-monitor
    ;;
  stop)
    exec "${compose_runner}" --profile monitor stop agenthub-runner-monitor
    ;;
  logs)
    exec "${compose_runner}" --profile monitor logs -f --tail=50 agenthub-runner-monitor
    ;;
  once)
    exec "${compose_runner}" run --rm --no-deps agenthub-runner --heartbeat-only --once
    ;;
  *)
    printf '%s\n' "Usage: $0 {start|stop|logs|once}" >&2
    exit 2
    ;;
esac
