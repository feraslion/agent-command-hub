import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

describe("Runner heartbeat-only monitor", () => {
  it("reports a heartbeat before deciding whether claims are permitted", () => {
    const runner = read("runner/local-runner.mjs");
    const heartbeat = runner.indexOf('await call("/api/local-runner/heartbeat"');
    const heartbeatOnlyGuard = runner.indexOf('if (args["heartbeat-only"])');
    const claim = runner.indexOf('await call("/api/local-runner/claim")');
    expect(heartbeat).toBeGreaterThan(-1);
    expect(heartbeatOnlyGuard).toBeGreaterThan(heartbeat);
    expect(claim).toBeGreaterThan(heartbeatOnlyGuard);
  });

  it("runs the monitor through heartbeat-only once mode and applies a bounded interval", () => {
    const monitor = read("runner/device/watch-runner-heartbeat.sh");
    expect(monitor).toContain("--heartbeat-only --once");
    expect(monitor).toContain("interval < 15 || interval > 3600");
    expect(monitor).toContain("no execution claim was requested");
  });

  it("keeps the Compose monitor optional and gives it lower resource limits", () => {
    const compose = read("runner/device/docker-compose.runner.yml");
    expect(compose).toContain("agenthub-runner-monitor:");
    expect(compose).toContain("- monitor");
    expect(compose).toContain("mem_limit: 256m");
    expect(compose).toContain("cpus: 0.25");
  });
});
