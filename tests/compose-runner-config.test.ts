import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

describe("local Runner Compose configuration", () => {
  it("keeps the outer Runner constrained while mounting only its config, workspace, and Docker socket", () => {
    const compose = read("runner/device/docker-compose.runner.yml");
    expect(compose).toContain("/var/run/docker.sock");
    expect(compose).toContain("./.env.runner");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("cap_drop:");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toContain("pids_limit: 128");
    expect(compose).toContain("AGENTHUB_RUNNER_HOST_WORKSPACE_ROOT");
  });

  it("uses a host-visible transient workspace so the Docker daemon can mount execution files", () => {
    const runner = read("runner/local-runner.mjs");
    expect(runner).toContain("createExecutionWorkspace");
    expect(runner).toContain("AGENTHUB_RUNNER_WORKSPACE_ROOT");
    expect(runner).toContain("AGENTHUB_RUNNER_HOST_WORKSPACE_ROOT");
    expect(runner).toContain("src=${dockerWorkspace}");
  });

  it("does not add secrets to Compose commands or the built image", () => {
    const dockerfile = read("runner/device/Dockerfile.local-runner");
    const wrapper = read("runner/device/run-compose-runner.sh");
    expect(dockerfile).not.toContain(".env.runner");
    expect(wrapper).not.toContain("cat \"${config_path}\"");
    expect(wrapper).toContain("--env-file \"${config_path}\"");
  });
});
