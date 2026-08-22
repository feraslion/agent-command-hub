import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const prepareScript = path.join(projectRoot, "runner", "device", "prepare-runner-pairing.sh");
const temporaryDirectories: string[] = [];

function temporaryDirectory() {
  const directory = mkdtempSync(path.join(tmpdir(), "agenthub-runner-pairing-"));
  temporaryDirectories.push(directory);
  return directory;
}

function runPreparation(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn("bash", [prepareScript, ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

afterEach(() => {
  while (temporaryDirectories.length) rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
});

describe("deferred local Runner pairing preparation", () => {
  it("creates a permission-restricted local template without creating credentials", async () => {
    const directory = temporaryDirectory();
    const config = path.join(directory, ".env.runner");
    const result = await runPreparation(["--server", "https://hub.example.test", "--config", config]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("No Runner key or token was created");
    const content = readFileSync(config, "utf8");
    expect(content).toContain("AGENTHUB_SERVER=https://hub.example.test");
    expect(content).toContain("AGENTHUB_RUNNER_KEY=PASTE_RUNNER_KEY_HERE");
    expect(content).toContain("AGENTHUB_RUNNER_TOKEN=PASTE_ONE_TIME_TOKEN_HERE");
    expect(statSync(config).mode & 0o777).toBe(0o600);
  });

  it("refuses to overwrite an existing local configuration by default", async () => {
    const directory = temporaryDirectory();
    const config = path.join(directory, ".env.runner");
    writeFileSync(config, "AGENTHUB_RUNNER_TOKEN=private-value\n", "utf8");
    const result = await runPreparation(["--server", "https://hub.example.test", "--config", config]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("already exists");
    expect(readFileSync(config, "utf8")).toBe("AGENTHUB_RUNNER_TOKEN=private-value\n");
  });

  it("rejects an unsafe server URL before writing the configuration", async () => {
    const directory = temporaryDirectory();
    const config = path.join(directory, ".env.runner");
    const result = await runPreparation(["--server", "http://user:secret@hub.example.test", "--config", config]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("must be an HTTPS URL");
    expect(() => statSync(config)).toThrow();
  });
});
