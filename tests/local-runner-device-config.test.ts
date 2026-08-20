import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const launcherPath = path.join(projectRoot, "runner", "device", "run-local-runner.sh");
const temporaryDirectories: string[] = [];

function createTemporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("local Runner device configuration", () => {
  it("loads the approved configuration variables and performs Docker preflight without printing the token", () => {
    const dockerDirectory = createTemporaryDirectory("agenthub-docker-config-mock-");
    const configDirectory = createTemporaryDirectory("agenthub-runner-config-");
    const dockerPath = path.join(dockerDirectory, "docker");
    const configPath = path.join(configDirectory, ".env.runner");

    writeFileSync(dockerPath, `#!/usr/bin/env sh
if [ "$1" = "info" ]; then printf '%s\\n' '27.2.1'; exit 0; fi
if [ "$1" = "image" ] && [ "$2" = "inspect" ] && { [ "$3" = "node:22-alpine" ] || [ "$3" = "agenthub-runner-ts:5.7.3" ]; }; then printf '%s\\n' 'sha256:verified'; exit 0; fi
exit 1
`, "utf8");
    chmodSync(dockerPath, 0o755);
    writeFileSync(configPath, "AGENTHUB_SERVER=https://hub.example.test\nAGENTHUB_RUNNER_KEY=runner_test_key\nAGENTHUB_RUNNER_TOKEN=secret-token-must-not-print\nAGENTHUB_RUN_ONCE=true\n", "utf8");

    const result = spawnSync("bash", [launcherPath, "--config", configPath, "--check-config"], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${dockerDirectory}:${process.env.PATH ?? ""}` },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Runner configuration is valid for https://hub.example.test");
    expect(result.stdout).toContain("Docker ready (server 27.2.1, images verified)");
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("secret-token-must-not-print");
  });

  it("refuses values that are still copied from the example configuration", () => {
    const configDirectory = createTemporaryDirectory("agenthub-runner-example-config-");
    const configPath = path.join(configDirectory, ".env.runner");
    writeFileSync(configPath, "AGENTHUB_SERVER=https://YOUR-AGENT-HUB-DOMAIN\nAGENTHUB_RUNNER_KEY=PASTE_RUNNER_KEY_HERE\nAGENTHUB_RUNNER_TOKEN=PASTE_ONE_TIME_TOKEN_HERE\nAGENTHUB_RUN_ONCE=false\n", "utf8");

    const result = spawnSync("bash", [launcherPath, "--config", configPath, "--check-config"], { encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Runner configuration still contains example values");
  });
});
