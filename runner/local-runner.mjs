#!/usr/bin/env node
/**
 * Agent Command Hub local Runner — phase 1.
 *
 * This client accepts only an issued runner key/token pair, claims approved
 * node_script requests, writes one validated standalone source file into a
 * temporary directory, and invokes it inside a hardened Docker container.
 * It never mounts a user directory, sends host environment variables, or
 * accepts the image/command from the server.
 */
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const IMAGE = "node:22-alpine";
const POLL_MS = 5_000;
const TIMEOUT_MS = 15_000;
const OUTPUT_LIMIT = 8_000;
const BLOCKED = [
  /\bimport\s*(?:\(|[\w{*])/u,
  /\brequire\s*\(/u,
  /\bchild_process\b/u,
  /\bprocess\.env\b/u,
  /\bfetch\s*\(/u,
  /\b(?:http|https|net|tls|dgram|cluster|worker_threads|vm|fs)\b/u,
  /\b(?:eval|Function)\s*\(/u,
];

function usage() {
  console.error("Usage: node runner/local-runner.mjs --server https://host --runner runner-key --token runner-token [--once]");
  process.exitCode = 2;
}

function readArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    if (name === "once") values.once = true;
    else values[name] = argv[index + 1];
  }
  return values;
}

function capped(current, next) {
  if (current.length >= OUTPUT_LIMIT) return current;
  return `${current}${next}`.slice(0, OUTPUT_LIMIT);
}

function assertPayload(payload) {
  if (!payload || payload.profile !== "node_script" || typeof payload.targetPath !== "string" || typeof payload.content !== "string") {
    throw new Error("Runner received an invalid execution payload.");
  }
  const normalized = payload.targetPath.replaceAll("\\", "/");
  const [directory, ...rest] = normalized.split("/");
  const ext = path.extname(normalized).toLowerCase();
  if (!["source", "tests"].includes(directory) || rest.length === 0 || normalized.includes("..") || ![".js", ".mjs", ".cjs"].includes(ext)) {
    throw new Error("Runner rejected the workspace path or file extension.");
  }
  if (!payload.content.trim() || Buffer.byteLength(payload.content, "utf8") > 32_000 || BLOCKED.some((pattern) => pattern.test(payload.content))) {
    throw new Error("Runner rejected source that exceeds the local safety policy.");
  }
  return normalized;
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout = capped(stdout, chunk.toString()); });
    child.stderr.on("data", (chunk) => { stderr = capped(stderr, chunk.toString()); });
    child.once("error", (error) => resolve({ code: 1, stdout, stderr: capped(stderr, error.message) }));
    child.once("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function execute(payload) {
  const targetPath = assertPayload(payload);
  const workspace = await mkdtemp(path.join(tmpdir(), "agenthub-runner-"));
  const targetFile = path.resolve(workspace, targetPath);
  const containerName = `agenthub-${payload.requestId}-${randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();

  try {
    if (!targetFile.startsWith(`${workspace}${path.sep}`)) throw new Error("Runner rejected path traversal.");
    await chmod(workspace, 0o755);
    await mkdir(path.dirname(targetFile), { recursive: true, mode: 0o755 });
    await chmod(path.dirname(targetFile), 0o755);
    await writeFile(targetFile, payload.content, { encoding: "utf8", mode: 0o444 });

    const dockerArgs = [
      "run", "--rm", "--name", containerName,
      "--network", "none",
      "--read-only",
      "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", "64",
      "--memory", "256m",
      "--cpus", "0.5",
      "--user", "1000:1000",
      "--workdir", "/workspace",
      "--mount", `type=bind,src=${workspace},dst=/workspace,readonly`,
      IMAGE,
      "node", "--disable-proto=throw", "--frozen-intrinsics", `/${targetPath}`,
    ];
    const execution = await new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        await run("docker", ["kill", containerName]);
        resolve({ code: 124, stdout: "", stderr: "Execution timed out after 15 seconds." });
      }, TIMEOUT_MS);
      void run("docker", dockerArgs).then((result) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
    return { ...execution, durationMs: Date.now() - startedAt };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  if (typeof args.server !== "string" || typeof args.runner !== "string" || typeof args.token !== "string") return usage();
  const baseUrl = args.server.replace(/\/+$/, "");
  const headers = { "content-type": "application/json", authorization: `Bearer ${args.token}`, "x-agenthub-runner": args.runner };
  const call = async (pathName, body = {}) => {
    const response = await fetch(`${baseUrl}${pathName}`, { method: "POST", headers, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `Runner API returned ${response.status}.`);
    return payload;
  };

  const tick = async () => {
    await call("/api/local-runner/heartbeat", { capabilities: { profile: "node_script", docker: true } });
    const claim = await call("/api/local-runner/claim");
    if (!claim.request) return false;
    let result;
    try {
      result = await execute(claim.request);
    } catch (error) {
      result = { code: 1, stdout: "", stderr: error instanceof Error ? error.message : "Runner failed unexpectedly.", durationMs: 0 };
    }
    await call("/api/local-runner/report", {
      requestId: claim.request.requestId,
      status: result.code === 0 ? "completed" : "failed",
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
    });
    console.log(`[runner] ${claim.request.requestId} ${result.code === 0 ? "completed" : "failed"} in ${result.durationMs}ms`);
    return true;
  };

  do {
    try {
      await tick();
    } catch (error) {
      console.error(`[runner] ${error instanceof Error ? error.message : "unknown error"}`);
      if (args.once) process.exitCode = 1;
    }
    if (!args.once) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  } while (!args.once);
}

void main();
