import path from "node:path";

export const localRunnerProfileValues = ["node_script"] as const;
export type LocalRunnerProfile = (typeof localRunnerProfileValues)[number];

export const localRunnerPolicy = {
  image: "node:22-alpine",
  maxSourceBytes: 32_000,
  timeoutMs: 15_000,
  memoryMb: 256,
  cpuLimit: 0.5,
  pidsLimit: 64,
  stdoutLimit: 8_000,
  stderrLimit: 8_000,
  allowedDirectories: ["source", "tests"],
  allowedExtensions: [".js", ".mjs", ".cjs"],
} as const;

const blockedSourcePatterns = [
  /\bimport\s*(?:\(|[\w{*])/u,
  /\brequire\s*\(/u,
  /\bchild_process\b/u,
  /\bprocess\.env\b/u,
  /\bfetch\s*\(/u,
  /\b(?:http|https|net|tls|dgram|cluster|worker_threads|vm|fs)\b/u,
  /\b(?:eval|Function)\s*\(/u,
] as const;

export class LocalRunnerPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalRunnerPolicyError";
  }
}

export function assertLocalRunnerExecutable(pathValue: string, content: string) {
  const normalized = pathValue.trim().replaceAll("\\", "/");
  const [directory] = normalized.split("/");
  const extension = path.extname(normalized).toLowerCase();

  if (!localRunnerPolicy.allowedDirectories.includes(directory as (typeof localRunnerPolicy.allowedDirectories)[number])) {
    throw new LocalRunnerPolicyError("يسمح Runner المحلي بتنفيذ ملفات source أو tests فقط.");
  }
  if (!localRunnerPolicy.allowedExtensions.includes(extension as (typeof localRunnerPolicy.allowedExtensions)[number])) {
    throw new LocalRunnerPolicyError("المرحلة الأولى تدعم ملفات JavaScript المستقلة فقط (.js و.mjs و.cjs).");
  }
  if (!content.trim() || Buffer.byteLength(content, "utf8") > localRunnerPolicy.maxSourceBytes) {
    throw new LocalRunnerPolicyError("محتوى الملف فارغ أو يتجاوز حد التنفيذ المحلي الآمن.");
  }
  if (blockedSourcePatterns.some((pattern) => pattern.test(content))) {
    throw new LocalRunnerPolicyError("يحتوي الملف على استيراد أو وصول نظام أو شبكة أو تنفيذ ديناميكي محجوب في Runner المحلي.");
  }

  return { normalizedPath: normalized, profile: "node_script" as const };
}

export function truncateRunnerOutput(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n… [تم اقتطاع المخرجات لحماية السجل]`;
}
