import path from "node:path";

export const multiFileRunnerPolicy = {
  profile: "typescript_multi_file",
  maxFiles: 24,
  maxTotalBytes: 96_000,
  maxSingleFileBytes: 24_000,
  allowedRoots: ["source", "tests"],
  allowedExtensions: [".ts", ".mts", ".cts"],
  timeoutMs: 20_000,
  memoryMb: 384,
  cpuLimit: 0.75,
  pidsLimit: 96,
} as const;

export class MultiFileRunnerPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MultiFileRunnerPolicyError";
  }
}

type BundleFile = { path: string; content: string };

const blockedPatterns = [
  /\brequire\s*\(/u,
  /\bimport\s*\(/u,
  /\bchild_process\b/u,
  /\bprocess\.env\b/u,
  /\bfetch\s*\(/u,
  /\b(?:http|https|net|tls|dgram|cluster|worker_threads|vm|fs)\b/u,
  /\b(?:eval|Function)\s*\(/u,
] as const;

function normalizeBundlePath(value: string) {
  const normalized = value.trim().replaceAll("\\", "/");
  const [root] = normalized.split("/");
  const extension = path.extname(normalized).toLowerCase();
  if (!normalized || normalized.includes("/../") || normalized.startsWith("../") || !/^(?:source|tests)(?:\/[A-Za-z0-9._-]+)+\.(?:ts|mts|cts)$/u.test(normalized)) {
    throw new MultiFileRunnerPolicyError("تقتصر الحزمة متعددة الملفات على TypeScript داخل source أو tests فقط.");
  }
  if (!multiFileRunnerPolicy.allowedRoots.includes(root as (typeof multiFileRunnerPolicy.allowedRoots)[number]) || !multiFileRunnerPolicy.allowedExtensions.includes(extension as (typeof multiFileRunnerPolicy.allowedExtensions)[number])) {
    throw new MultiFileRunnerPolicyError("مسار أو امتداد الحزمة متعددة الملفات غير مسموح.");
  }
  return normalized;
}

function assertImportsAreRelative(content: string) {
  const imports = content.matchAll(/\bimport\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/gu);
  for (const match of imports) {
    if (!match[1].startsWith("./") && !match[1].startsWith("../")) {
      throw new MultiFileRunnerPolicyError("تمنع بيئة الملفات المتعددة استيراد الحزم الخارجية أو وحدات النظام.");
    }
  }
}

export function assertMultiFileBundle(entryPath: string, files: BundleFile[]) {
  const entry = normalizeBundlePath(entryPath);
  if (!Array.isArray(files) || files.length < 2 || files.length > multiFileRunnerPolicy.maxFiles) throw new MultiFileRunnerPolicyError("تتطلب البيئة المستقلة من 2 إلى 24 ملف TypeScript.");
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const file of files) {
    const normalizedPath = normalizeBundlePath(file.path);
    if (seen.has(normalizedPath)) throw new MultiFileRunnerPolicyError("تحتوي الحزمة على مسارات مكررة.");
    seen.add(normalizedPath);
    if (!file.content.trim()) throw new MultiFileRunnerPolicyError("لا تقبل الحزمة ملفات فارغة.");
    const size = Buffer.byteLength(file.content, "utf8");
    if (size > multiFileRunnerPolicy.maxSingleFileBytes) throw new MultiFileRunnerPolicyError("يتجاوز أحد الملفات حد الحجم المسموح.");
    totalBytes += size;
    if (blockedPatterns.some((pattern) => pattern.test(file.content))) throw new MultiFileRunnerPolicyError("تحتوي الحزمة على وصول محظور للنظام أو الشبكة أو تنفيذ ديناميكي.");
    assertImportsAreRelative(file.content);
  }
  if (totalBytes > multiFileRunnerPolicy.maxTotalBytes) throw new MultiFileRunnerPolicyError("تتجاوز الحزمة متعددة الملفات حد الحجم الإجمالي.");
  if (!seen.has(entry)) throw new MultiFileRunnerPolicyError("ملف الدخول غير موجود ضمن الحزمة.");
  return { entryPath: entry, files: files.map((file) => ({ path: normalizeBundlePath(file.path), content: file.content })), totalBytes };
}
