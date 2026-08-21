import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const runnerPath = path.join(projectRoot, "runner", "local-runner.mjs");
const temporaryDirectories: string[] = [];

function temporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function readBody(request: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk.toString(); });
    request.on("end", () => resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {}));
  });
}

function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function runRunner(args: string[], env: Record<string, string | undefined>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [runnerPath, ...args], { env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function createDockerMock() {
  const directory = temporaryDirectory("agenthub-runner-e2e-docker-");
  const dockerPath = path.join(directory, "docker");
  const logPath = path.join(directory, "docker-args.log");
  writeFileSync(dockerPath, `#!/usr/bin/env sh
set -eu
printf '%s\\n' "$*" >> "$RUNNER_E2E_DOCKER_LOG"
if [ "$1" = "info" ]; then printf '%s\\n' '27.2.1'; exit 0; fi
if [ "$1" = "image" ] && [ "$2" = "inspect" ]; then printf '%s\\n' 'sha256:e2e-image'; exit 0; fi
if [ "$1" = "run" ]; then printf '%s\\n' 'runner smoke ok'; exit 0; fi
if [ "$1" = "kill" ]; then exit 0; fi
exit 1
`, "utf8");
  chmodSync(dockerPath, 0o755);
  return { directory, logPath };
}

function runnerArguments(serverUrl: string) {
  return ["--server", serverUrl, "--runner", "runner-1234abcdef56", "--token", "t".repeat(32), "--once"];
}

afterEach(() => {
  while (temporaryDirectories.length) rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
});

describe("local Runner E2E process", () => {
  it("executes the real client flow: preflight → heartbeat → claim → hardened run → report", async () => {
    const received: { heartbeat?: Record<string, unknown>; reports: Record<string, unknown>[]; claims: number } = { reports: [], claims: 0 };
    const server = createServer(async (request, response) => {
      const body = await readBody(request);
      expect(request.headers.authorization).toBe(`Bearer ${"t".repeat(32)}`);
      expect(request.headers["x-agenthub-runner"]).toBe("runner-1234abcdef56");
      if (request.url === "/api/local-runner/heartbeat") { received.heartbeat = body; return reply(response, 200, { runner: { runnerKey: "runner-1234abcdef56", status: "ready" } }); }
      if (request.url === "/api/local-runner/claim") { received.claims += 1; return reply(response, 200, { request: { requestId: 73, profile: "node_script", targetPath: "source/hello.js", content: "console.log('smoke')" } }); }
      if (request.url === "/api/local-runner/report") { received.reports.push(body); return reply(response, 200, { request: { id: 73, status: "completed", completedAt: new Date().toISOString() } }); }
      return reply(response, 404, { error: "not found" });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const docker = createDockerMock();
    try {
      const result = await runRunner(runnerArguments(`http://127.0.0.1:${port}`), { PATH: `${docker.directory}:${process.env.PATH ?? ""}`, RUNNER_E2E_DOCKER_LOG: docker.logPath });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Docker ready");
      expect(result.stdout).toContain("73 completed");
      expect((received.heartbeat?.capabilities as { docker?: boolean }).docker).toBe(true);
      expect(received.claims).toBe(1);
      expect(received.reports).toHaveLength(1);
      expect(received.reports[0]).toMatchObject({ requestId: 73, status: "completed", exitCode: 0, stdout: "runner smoke ok\n" });
      const dockerArgs = readFileSync(docker.logPath, "utf8");
      expect(dockerArgs).toContain("--network none");
      expect(dockerArgs).toContain("--read-only");
      expect(dockerArgs).toContain("--cap-drop ALL");
      expect(dockerArgs).toContain("--security-opt no-new-privileges");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("stays healthy when no approved request is available and does not fabricate a report", async () => {
    const calls: string[] = [];
    const server = createServer(async (request, response) => {
      await readBody(request);
      calls.push(request.url ?? "");
      if (request.url === "/api/local-runner/heartbeat") return reply(response, 200, { runner: { runnerKey: "runner-1234abcdef56", status: "ready" } });
      if (request.url === "/api/local-runner/claim") return reply(response, 200, { request: null });
      return reply(response, 500, { error: "unexpected report" });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const docker = createDockerMock();
    try {
      const port = (server.address() as { port: number }).port;
      const result = await runRunner(runnerArguments(`http://127.0.0.1:${port}`), { PATH: `${docker.directory}:${process.env.PATH ?? ""}`, RUNNER_E2E_DOCKER_LOG: docker.logPath });
      expect(result.code).toBe(0);
      expect(calls).toEqual(["/api/local-runner/heartbeat", "/api/local-runner/claim"]);
      expect(readFileSync(docker.logPath, "utf8")).not.toContain("run --rm");
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });

  it("heartbeat-only mode reports readiness without claiming or executing any Runtime request", async () => {
    const calls: string[] = [];
    const server = createServer(async (request, response) => {
      await readBody(request);
      calls.push(request.url ?? "");
      if (request.url === "/api/local-runner/heartbeat") return reply(response, 200, { runner: { runnerKey: "runner-1234abcdef56", status: "ready" } });
      return reply(response, 500, { error: "heartbeat-only mode must not call this endpoint" });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const docker = createDockerMock();
    try {
      const port = (server.address() as { port: number }).port;
      const result = await runRunner([...runnerArguments(`http://127.0.0.1:${port}`), "--heartbeat-only"], { PATH: `${docker.directory}:${process.env.PATH ?? ""}`, RUNNER_E2E_DOCKER_LOG: docker.logPath });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("heartbeat reported");
      expect(calls).toEqual(["/api/local-runner/heartbeat"]);
      expect(readFileSync(docker.logPath, "utf8")).not.toContain("run --rm");
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });

  it("accepts a TypeScript multi-file bundle with a relative import and uses the pinned image", async () => {
    let report: Record<string, unknown> | undefined;
    const server = createServer(async (request, response) => {
      const body = await readBody(request);
      if (request.url === "/api/local-runner/heartbeat") return reply(response, 200, { runner: { runnerKey: "runner-1234abcdef56", status: "ready" } });
      if (request.url === "/api/local-runner/claim") return reply(response, 200, { request: { requestId: 84, profile: "typescript_multi_file", targetPath: "source/main.ts", files: [{ path: "source/main.ts", content: "import { message } from './message.js'; console.log(message);" }, { path: "source/message.ts", content: "export const message = 'bundle smoke';" }] } });
      if (request.url === "/api/local-runner/report") { report = body; return reply(response, 200, { request: { id: 84, status: "completed" } }); }
      return reply(response, 404, {});
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const docker = createDockerMock();
    try {
      const port = (server.address() as { port: number }).port;
      const result = await runRunner(runnerArguments(`http://127.0.0.1:${port}`), { PATH: `${docker.directory}:${process.env.PATH ?? ""}`, RUNNER_E2E_DOCKER_LOG: docker.logPath });
      expect(result.code).toBe(0);
      expect(report).toMatchObject({ requestId: 84, status: "completed", exitCode: 0 });
      const dockerArgs = readFileSync(docker.logPath, "utf8");
      expect(dockerArgs).toContain("agenthub-runner-ts:5.7.3");
      expect(dockerArgs).toContain("--pids-limit 96");
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });

  it("rejects a malicious claimed payload before Docker and reports the failure deterministically", async () => {
    let report: Record<string, unknown> | undefined;
    const server = createServer(async (request, response) => {
      const body = await readBody(request);
      if (request.url === "/api/local-runner/heartbeat") return reply(response, 200, { runner: { runnerKey: "runner-1234abcdef56", status: "ready" } });
      if (request.url === "/api/local-runner/claim") return reply(response, 200, { request: { requestId: 91, profile: "node_script", targetPath: "../secrets.js", content: "console.log('unsafe')" } });
      if (request.url === "/api/local-runner/report") { report = body; return reply(response, 200, { request: { id: 91, status: "failed" } }); }
      return reply(response, 404, {});
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const docker = createDockerMock();
    try {
      const port = (server.address() as { port: number }).port;
      const result = await runRunner(runnerArguments(`http://127.0.0.1:${port}`), { PATH: `${docker.directory}:${process.env.PATH ?? ""}`, RUNNER_E2E_DOCKER_LOG: docker.logPath });
      expect(result.code).toBe(0);
      expect(report).toMatchObject({ requestId: 91, status: "failed", exitCode: 1 });
      expect(String(report?.stderr)).toContain("Runner rejected the workspace path");
      expect(readFileSync(docker.logPath, "utf8")).not.toContain("run --rm");
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });

  it("fails closed on an authentication rejection before it can claim work", async () => {
    const calls: string[] = [];
    const server = createServer(async (request, response) => {
      await readBody(request);
      calls.push(request.url ?? "");
      return reply(response, 401, { error: "Local runner authentication failed." });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const docker = createDockerMock();
    try {
      const port = (server.address() as { port: number }).port;
      const result = await runRunner(runnerArguments(`http://127.0.0.1:${port}`), { PATH: `${docker.directory}:${process.env.PATH ?? ""}`, RUNNER_E2E_DOCKER_LOG: docker.logPath });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Local runner authentication failed");
      expect(calls).toEqual(["/api/local-runner/heartbeat"]);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
