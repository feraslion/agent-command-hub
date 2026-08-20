import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const runnerPath = path.join(projectRoot, "runner", "local-runner.mjs");
const temporaryDirectories: string[] = [];

function createDockerMock(script: string) {
  const directory = mkdtempSync(path.join(tmpdir(), "agenthub-docker-mock-"));
  temporaryDirectories.push(directory);
  const dockerPath = path.join(directory, "docker");
  writeFileSync(dockerPath, `#!/usr/bin/env sh\n${script}\n`, "utf8");
  chmodSync(dockerPath, 0o755);
  return directory;
}

function preflightWithMock(mockPath: string) {
  return spawnSync(process.execPath, [runnerPath, "--preflight"], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${mockPath}:${process.env.PATH ?? ""}` },
  });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("local Runner Docker preflight", () => {
  it("accepts a reachable daemon with both pinned images", () => {
    const mockPath = createDockerMock(`
if [ "$1" = "info" ]; then printf '%s\\n' '27.2.1'; exit 0; fi
if [ "$1" = "image" ] && [ "$2" = "inspect" ] && { [ "$3" = "node:22-alpine" ] || [ "$3" = "agenthub-runner-ts:5.7.3" ]; }; then printf '%s\\n' 'sha256:verified'; exit 0; fi
exit 1`);

    const result = preflightWithMock(mockPath);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Docker ready (server 27.2.1, images verified)");
  });

  it("stops before any API connection when the Docker daemon is unavailable", () => {
    const mockPath = createDockerMock("printf '%s\\n' 'daemon unavailable' >&2\nexit 1");

    const result = preflightWithMock(mockPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Docker preflight failed: the Docker daemon is unavailable");
  });
});
