#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config_path="${repository_root}/runner/device/.env.runner"
server_url="https://agenthub-gkta8g2i.manus.space"
overwrite="false"

usage() {
  cat >&2 <<EOF
Usage:
  $0 [--server HTTPS_URL] [--config PATH] [--overwrite]

Creates a local Runner configuration with placeholder credentials only.
It never creates, prints, or stores an issued Runner token.
The default server is: https://agenthub-gkta8g2i.manus.space
EOF
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server)
      [[ $# -ge 2 ]] || usage
      server_url="$2"
      shift 2
      ;;
    --config)
      [[ $# -ge 2 ]] || usage
      config_path="$2"
      shift 2
      ;;
    --overwrite)
      overwrite="true"
      shift
      ;;
    --help|-h)
      usage
      ;;
    *)
      usage
      ;;
  esac
done

if [[ ! "${server_url}" =~ ^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?(/[^[:space:]?#]*)?$ ]]; then
  printf '%s\n' "Runner server must be an HTTPS URL without credentials, query parameters, or fragments." >&2
  exit 1
fi

config_directory="$(dirname "${config_path}")"
if [[ ! -d "${config_directory}" ]]; then
  printf '%s\n' "Configuration directory does not exist: ${config_directory}" >&2
  exit 1
fi

if [[ -e "${config_path}" && "${overwrite}" != "true" ]]; then
  printf '%s\n' "Runner configuration already exists: ${config_path}" >&2
  printf '%s\n' "It was not changed. Use --overwrite only after you have intentionally removed any old credentials." >&2
  exit 1
fi

umask 077
cat > "${config_path}" <<EOF
# Local-only Runner configuration. This file is ignored by Git.
# Values are literal: do not add quotes, shell expressions, or inline comments.
AGENTHUB_SERVER=${server_url}
AGENTHUB_RUNNER_KEY=PASTE_RUNNER_KEY_HERE
AGENTHUB_RUNNER_TOKEN=PASTE_ONE_TIME_TOKEN_HERE
# true performs exactly one heartbeat and claim cycle after pairing.
AGENTHUB_RUN_ONCE=true
EOF
chmod 600 "${config_path}"

cat <<EOF
Prepared a local-only Runner configuration at: ${config_path}

No Runner key or token was created, printed, or stored.
When you have access to the Docker device:
  1. Open Settings → Local Runner in Agent Command Hub and create a pairing.
  2. Replace only the two placeholder credential values in this file.
  3. Run ./runner/device/build-typescript-image.sh
  4. Run ./runner/device/smoke-test-typescript.sh
  5. Run ./runner/device/run-local-runner.sh --check-config
  6. Run ./runner/device/run-local-runner.sh --once
EOF
