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
import { chmod, lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { dockerRecoveryGuide } from "./docker-support.mjs";

const NODE_IMAGE = "node:22-alpine";
const TYPESCRIPT_IMAGE = "agenthub-runner-ts:5.7.3";
const POLL_MS = 5_000;
const TIMEOUT_MS = 15_000;
const OUTPUT_LIMIT = 8_000;
const MAX_REPOSITORY_FILES = 20_000;
const SKIPPED_REPOSITORY_DIRECTORIES = new Set([".git", ".expo", ".next", "build", "coverage", "dist", "node_modules", "vendor"]);
const MANIFEST_FILES = new Set(["package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb", "composer.json", "pyproject.toml", "requirements.txt", "go.mod", "cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts", "dockerfile", "makefile"]);
const LANGUAGE_BY_EXTENSION = { ".c": "C", ".cpp": "C++", ".cs": "C#", ".css": "CSS", ".go": "Go", ".html": "HTML", ".java": "Java", ".js": "JavaScript", ".jsx": "JavaScript", ".kt": "Kotlin", ".kts": "Kotlin", ".md": "Markdown", ".mjs": "JavaScript", ".php": "PHP", ".py": "Python", ".rb": "Ruby", ".rs": "Rust", ".sh": "Shell", ".sql": "SQL", ".ts": "TypeScript", ".tsx": "TypeScript", ".vue": "Vue", ".yaml": "YAML", ".yml": "YAML" };
const BLOCKED = [
  /\bimport\s*(?:\(|[\w{*])/u,
  /\brequire\s*\(/u,
  /\bchild_process\b/u,
  /\bprocess\.env\b/u,
  /\bfetch\s*\(/u,
  /\b(?:http|https|net|tls|dgram|cluster|worker_threads|vm|fs)\b/u,
  /\b(?:eval|Function)\s*\(/u,
];
const MULTI_FILE_BLOCKED = BLOCKED.slice(1);

function usage() {
  console.error("Usage: node runner/local-runner.mjs --server https://host --runner runner-key --token runner-token [--once] | --preflight | --scan-dir <directory> --project <projectId> [--scan-label <label>]");
  process.exitCode = 2;
}

function readArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    if (name === "once" || name === "preflight") values[name] = true;
    else values[name] = argv[index + 1];
  }
  return values;
}

function capped(current, next) {
  if (current.length >= OUTPUT_LIMIT) return current;
  return `${current}${next}`.slice(0, OUTPUT_LIMIT);
}

function assertPayload(payload) {
  if (!payload || !["node_script", "typescript_lockfile", "typescript_multi_file"].includes(payload.profile) || typeof payload.targetPath !== "string") {
    throw new Error("Runner received an invalid execution payload.");
  }
  const normalized = payload.targetPath.replaceAll("\\", "/");
  const [directory, ...rest] = normalized.split("/");
  const ext = path.extname(normalized).toLowerCase();
  if (!["source", "tests"].includes(directory) || rest.length === 0 || !/^(?:source|tests)(?:\/[A-Za-z0-9._-]+)+\.(?:js|mjs|cjs|ts)$/u.test(normalized)) {
    throw new Error("Runner rejected the workspace path or file extension.");
  }
  if ((payload.profile === "typescript_lockfile" || payload.profile === "typescript_multi_file") !== [".ts", ".mts", ".cts"].includes(ext)) throw new Error("Runner rejected a profile that does not match the file extension.");
  if (payload.profile !== "typescript_multi_file") {
    if (typeof payload.content !== "string" || !payload.content.trim() || Buffer.byteLength(payload.content, "utf8") > 32_000 || BLOCKED.some((pattern) => pattern.test(payload.content))) {
      throw new Error("Runner rejected source that exceeds the local safety policy.");
    }
    return { normalized, profile: payload.profile, files: [{ path: normalized, content: payload.content }] };
  }
  if (!Array.isArray(payload.files) || payload.files.length < 2 || payload.files.length > 24) {
    throw new Error("Runner rejected the multi-file bundle size.");
  }
  const seen = new Set();
  let totalBytes = 0;
  const files = payload.files.map((file) => {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") throw new Error("Runner rejected an invalid file in the multi-file bundle.");
    const filePath = file.path.replaceAll("\\", "/");
    const [fileDirectory, ...fileRest] = filePath.split("/");
    if (!['source', 'tests'].includes(fileDirectory) || fileRest.length === 0 || !/^(?:source|tests)(?:\/[A-Za-z0-9._-]+)+\.(?:ts|mts|cts)$/u.test(filePath) || seen.has(filePath)) throw new Error("Runner rejected a path in the multi-file bundle.");
    seen.add(filePath);
    const size = Buffer.byteLength(file.content, "utf8");
    totalBytes += size;
    if (!file.content.trim() || size > 24_000 || MULTI_FILE_BLOCKED.some((pattern) => pattern.test(file.content)) || /\b(?:require|import)\s*\(/u.test(file.content) || /\bimport\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["'](?!\.\.?\/)/u.test(file.content)) {
      throw new Error("Runner rejected prohibited code in the multi-file bundle.");
    }
    return { path: filePath, content: file.content };
  });
  if (totalBytes > 96_000 || !seen.has(normalized)) {
    throw new Error("Runner rejected source that exceeds the local safety policy.");
  }
  return { normalized, profile: payload.profile, files };
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

async function hostPlatform() {
  if (process.platform !== "linux") return { platform: process.platform };
  try {
    const osRelease = await readFile("/etc/os-release", "utf8");
    const linuxId = osRelease.match(/^ID=(?:"?)([A-Za-z0-9_-]+)(?:"?)$/mu)?.[1]?.toLowerCase() ?? "";
    return { platform: process.platform, linuxId };
  } catch {
    return { platform: process.platform, linuxId: "" };
  }
}

async function assertDockerReady() {
  const recovery = dockerRecoveryGuide(await hostPlatform());
  const daemon = await run("docker", ["info", "--format", "{{.Server.Version}}"]);
  if (daemon.code !== 0 || !daemon.stdout.trim()) {
    throw new Error(`Docker preflight failed: the Docker daemon is unavailable. ${recovery}${daemon.stderr ? ` Docker reported: ${daemon.stderr.trim()}` : ""}`);
  }

  for (const image of [NODE_IMAGE, TYPESCRIPT_IMAGE]) {
    const imageCheck = await run("docker", ["image", "inspect", image, "--format", "{{.Id}}"]);
    if (imageCheck.code !== 0 || !imageCheck.stdout.trim()) {
      const recovery = image === TYPESCRIPT_IMAGE
        ? "Run ./runner/device/build-typescript-image.sh on this device."
        : `Run docker pull ${NODE_IMAGE}.`;
      throw new Error(`Docker preflight failed: required image ${image} is unavailable. ${recovery}`);
    }
  }

  console.log(`[runner] Docker ready (server ${daemon.stdout.trim()}, images verified).`);
}

async function execute(payload) {
  const { normalized: targetPath, profile, files } = assertPayload(payload);
  const workspace = await mkdtemp(path.join(tmpdir(), "agenthub-runner-"));
  const containerName = `agenthub-${payload.requestId}-${randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();

  try {
    await chmod(workspace, 0o755);
    for (const file of files) {
      const targetFile = path.resolve(workspace, file.path);
      if (!targetFile.startsWith(`${workspace}${path.sep}`)) throw new Error("Runner rejected path traversal.");
      await mkdir(path.dirname(targetFile), { recursive: true, mode: 0o755 });
      await chmod(path.dirname(targetFile), 0o755);
      await writeFile(targetFile, file.content, { encoding: "utf8", mode: 0o444 });
    }

    const compileTargets = files.map((file) => `/${file.path}`).join(" ");
    const runtimeCommand = profile === "typescript_lockfile" || profile === "typescript_multi_file"
      ? ["sh", "-ceu", `/runtime/node_modules/.bin/tsc --pretty false --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir /tmp/compiled --rootDir /workspace -- ${compileTargets} && node --disable-proto=throw --frozen-intrinsics /tmp/compiled/${targetPath.replace(/\.(?:ts|mts|cts)$/u, ".js")}`]
      : ["node", "--disable-proto=throw", "--frozen-intrinsics", `/${targetPath}`];
    const dockerArgs = [
      "run", "--rm", "--name", containerName,
      "--network", "none",
      "--read-only",
      "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", profile === "typescript_multi_file" ? "96" : "64",
      "--memory", profile === "typescript_multi_file" ? "384m" : "256m",
      "--cpus", profile === "typescript_multi_file" ? "0.75" : "0.5",
      "--user", "1000:1000",
      "--workdir", "/workspace",
      "--mount", `type=bind,src=${workspace},dst=/workspace,readonly`,
      profile === "typescript_lockfile" ? TYPESCRIPT_IMAGE : NODE_IMAGE,
      ...runtimeCommand,
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

function increment(values, key) {
  values[key] = (values[key] ?? 0) + 1;
}

function isSensitiveFileName(name) {
  return name === ".env" || name.startsWith(".env.") || /(?:^|[._-])(secret|credential|private|id_rsa|key)(?:[._-]|$)/iu.test(name);
}

async function scanRepository(scanDirectory, requestedLabel) {
  const root = await realpath(scanDirectory);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory()) throw new Error("Repository scan requires a directory selected by the device owner.");

  const languages = {};
  const manifests = new Set();
  const sensitiveSignals = new Set();
  let fileCount = 0;
  let directoryCount = 0;
  let testFileCount = 0;
  let testConfigCount = 0;
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_REPOSITORY_DIRECTORIES.has(entry.name)) continue;
        directoryCount += 1;
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      fileCount += 1;
      if (fileCount > MAX_REPOSITORY_FILES) throw new Error(`Repository scan stopped after ${MAX_REPOSITORY_FILES} files to protect the local device.`);
      const lowered = entry.name.toLowerCase();
      const language = LANGUAGE_BY_EXTENSION[path.extname(lowered)];
      if (language) increment(languages, language);
      if (MANIFEST_FILES.has(lowered)) manifests.add(entry.name);
      if (/(?:^|[._-])(test|spec)(?:[._-]|$)/iu.test(entry.name) || directory.split(path.sep).some((part) => part === "__tests__" || part === "tests")) testFileCount += 1;
      if (/^(?:vitest|jest|playwright|cypress)\.config\./iu.test(entry.name)) testConfigCount += 1;
      if (isSensitiveFileName(entry.name)) sensitiveSignals.add(entry.name === ".env" || entry.name.startsWith(".env.") ? "ملفات إعداد بيئي (.env)" : "أسماء قد تمثل مفاتيح أو بيانات اعتماد");
    }
  };
  await walk(root);
  return {
    displayName: (requestedLabel?.trim() || path.basename(root)).slice(0, 255),
    fileCount,
    directoryCount,
    languages,
    manifests: [...manifests].sort().slice(0, 30),
    testSignals: [`ملفات اختبار: ${testFileCount}`, `تهيئات اختبار: ${testConfigCount}`],
    sensitiveSignals: [...sensitiveSignals].sort().slice(0, 50),
  };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  if (args.preflight) {
    await assertDockerReady();
    return;
  }
  if (typeof args.server !== "string" || typeof args.runner !== "string" || typeof args.token !== "string") return usage();
  const baseUrl = args.server.replace(/\/+$/, "");
  const headers = { "content-type": "application/json", authorization: `Bearer ${args.token}`, "x-agenthub-runner": args.runner };
  const call = async (pathName, body = {}) => {
    const response = await fetch(`${baseUrl}${pathName}`, { method: "POST", headers, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `Runner API returned ${response.status}.`);
    return payload;
  };

  if (typeof args["scan-dir"] === "string") {
    const projectId = Number(args.project);
    if (!Number.isInteger(projectId) || projectId <= 0) throw new Error("Repository scan requires a positive --project ID.");
    const summary = await scanRepository(args["scan-dir"], typeof args["scan-label"] === "string" ? args["scan-label"] : "");
    const result = await call("/api/local-runner/repository-scan", { projectId, ...summary });
    console.log(`[runner] repository scan ${result.scan.id} reported for project ${projectId}.`);
    return;
  }

  await assertDockerReady();

  const tick = async () => {
    await call("/api/local-runner/heartbeat", { capabilities: { profiles: ["node_script", "typescript_lockfile", "typescript_multi_file"], docker: true, typescriptImage: TYPESCRIPT_IMAGE, repositoryScan: true } });
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

void main().catch((error) => {
  console.error(`[runner] ${error instanceof Error ? error.message : "Runner failed unexpectedly."}`);
  process.exitCode = 1;
});
