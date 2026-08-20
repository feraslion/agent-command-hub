#!/usr/bin/env bash
set -euo pipefail

image="agenthub-runner-ts:5.7.3"
workspace="$(mktemp -d -t agenthub-runner-smoke-XXXXXX)"
cleanup() { rm -rf "${workspace}"; }
trap cleanup EXIT

if ! docker image inspect "${image}" >/dev/null 2>&1; then
  printf '%s\n' "Missing ${image}. Run ./runner/device/build-typescript-image.sh first." >&2
  exit 1
fi

mkdir -p "${workspace}/tests"
cat > "${workspace}/tests/isolated.ts" <<'EOF'
const total: number = 40 + 2;
console.log(`runner-ts-smoke: ${total}`);
EOF
chmod -R a+rX "${workspace}"

docker run --rm \
  --network none \
  --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=16m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 64 \
  --memory 256m \
  --cpus 0.5 \
  --user 1000:1000 \
  --workdir /workspace \
  --mount "type=bind,src=${workspace},dst=/workspace,readonly" \
  "${image}" \
  sh -ceu '/runtime/node_modules/.bin/tsc --pretty false --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir /tmp/compiled --rootDir /workspace -- /workspace/tests/isolated.ts && node --disable-proto=throw --frozen-intrinsics /tmp/compiled/tests/isolated.js'
