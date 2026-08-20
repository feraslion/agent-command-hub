#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
default_config="${repository_root}/runner/device/.env.runner"
config_path="${default_config}"
once_requested="false"
check_config="false"
scan_directory=""
scan_project=""
scan_label=""
positional=()

usage() {
  cat >&2 <<EOF
Usage:
  $0 [--config PATH] [--once]
  $0 [--config PATH] --check-config
  $0 [--config PATH] --scan-dir DIRECTORY --project PROJECT_ID [--scan-label LABEL]
  $0 SERVER_URL RUNNER_KEY RUNNER_TOKEN [--once]

The default configuration file is: runner/device/.env.runner
EOF
  exit 2
}

load_config() {
  if [[ ! -f "${config_path}" ]]; then
    printf '%s\n' "Missing Runner configuration: ${config_path}" >&2
    printf '%s\n' "Create it from runner/device/.env.runner.example and restrict it with chmod 600." >&2
    exit 1
  fi

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    if [[ "${line}" =~ ^[[:space:]]*$ || "${line}" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    if [[ "${line}" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      case "${key}" in
        AGENTHUB_SERVER|AGENTHUB_RUNNER_KEY|AGENTHUB_RUNNER_TOKEN|AGENTHUB_RUN_ONCE)
          export "${key}=${value}"
          ;;
        *)
          printf '%s\n' "Unsupported variable in ${config_path}: ${key}" >&2
          exit 1
          ;;
      esac
    else
      printf '%s\n' "Invalid configuration line in ${config_path}. Use KEY=value without shell expressions." >&2
      exit 1
    fi
  done < "${config_path}"
}

validate_config() {
  if [[ -z "${AGENTHUB_SERVER:-}" || -z "${AGENTHUB_RUNNER_KEY:-}" || -z "${AGENTHUB_RUNNER_TOKEN:-}" ]]; then
    printf '%s\n' "Runner configuration must provide AGENTHUB_SERVER, AGENTHUB_RUNNER_KEY, and AGENTHUB_RUNNER_TOKEN." >&2
    exit 1
  fi
  if [[ "${AGENTHUB_SERVER}" == *"YOUR-AGENT-HUB-DOMAIN"* || "${AGENTHUB_RUNNER_KEY}" == "PASTE_RUNNER_KEY_HERE" || "${AGENTHUB_RUNNER_TOKEN}" == "PASTE_ONE_TIME_TOKEN_HERE" ]]; then
    printf '%s\n' "Runner configuration still contains example values. Replace them with the server URL and the issued Runner key and token." >&2
    exit 1
  fi
  if [[ ! "${AGENTHUB_SERVER}" =~ ^https?://[^[:space:]]+$ ]]; then
    printf '%s\n' "AGENTHUB_SERVER must start with http:// or https://." >&2
    exit 1
  fi
  if [[ "${AGENTHUB_RUN_ONCE:-false}" != "true" && "${AGENTHUB_RUN_ONCE:-false}" != "false" ]]; then
    printf '%s\n' "AGENTHUB_RUN_ONCE must be true or false." >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      [[ $# -ge 2 ]] || usage
      config_path="$2"
      shift 2
      ;;
    --once)
      once_requested="true"
      shift
      ;;
    --check-config)
      check_config="true"
      shift
      ;;
    --scan-dir)
      [[ $# -ge 2 ]] || usage
      scan_directory="$2"
      shift 2
      ;;
    --project)
      [[ $# -ge 2 ]] || usage
      scan_project="$2"
      shift 2
      ;;
    --scan-label)
      [[ $# -ge 2 ]] || usage
      scan_label="$2"
      shift 2
      ;;
    --help|-h)
      usage
      ;;
    --*)
      usage
      ;;
    *)
      positional+=("$1")
      shift
      ;;
  esac
done

if [[ ${#positional[@]} -gt 0 ]]; then
  [[ ${#positional[@]} -eq 3 && "${check_config}" == "false" ]] || usage
  AGENTHUB_SERVER="${positional[0]}"
  AGENTHUB_RUNNER_KEY="${positional[1]}"
  AGENTHUB_RUNNER_TOKEN="${positional[2]}"
  AGENTHUB_RUN_ONCE="${once_requested}"
else
  load_config
  if [[ "${once_requested}" == "true" ]]; then
    AGENTHUB_RUN_ONCE="true"
  fi
fi

validate_config

if [[ "${check_config}" == "true" ]]; then
  printf '%s\n' "Runner configuration is valid for ${AGENTHUB_SERVER}; starting Docker preflight."
  exec node "${repository_root}/runner/local-runner.mjs" --preflight
fi

command=(node "${repository_root}/runner/local-runner.mjs" --server "${AGENTHUB_SERVER}" --runner "${AGENTHUB_RUNNER_KEY}" --token "${AGENTHUB_RUNNER_TOKEN}")
if [[ -n "${scan_directory}" || -n "${scan_project}" || -n "${scan_label}" ]]; then
  [[ -n "${scan_directory}" && -n "${scan_project}" ]] || usage
  command+=(--scan-dir "${scan_directory}" --project "${scan_project}")
  if [[ -n "${scan_label}" ]]; then
    command+=(--scan-label "${scan_label}")
  fi
  exec "${command[@]}"
fi
if [[ "${AGENTHUB_RUN_ONCE:-false}" == "true" ]]; then
  command+=(--once)
fi

exec "${command[@]}"
