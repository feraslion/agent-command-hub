#!/usr/bin/env bash
set -euo pipefail

interval="${AGENTHUB_HEARTBEAT_INTERVAL_SECONDS:-60}"

if [[ ! "${interval}" =~ ^[0-9]+$ ]] || (( interval < 15 || interval > 3600 )); then
  printf '%s\n' "AGENTHUB_HEARTBEAT_INTERVAL_SECONDS must be an integer from 15 to 3600." >&2
  exit 2
fi

while true; do
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if /opt/agenthub/runner/device/run-local-runner.sh --heartbeat-only --once; then
    printf '%s\n' "[runner-monitor] ${timestamp} heartbeat succeeded; no execution claim was requested."
  else
    printf '%s\n' "[runner-monitor] ${timestamp} heartbeat failed; retrying in ${interval}s." >&2
  fi
  sleep "${interval}"
done
