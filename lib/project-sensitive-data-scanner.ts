import { inflateRawSync } from "node:zlib";

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const MAX_SCANNED_ENTRIES = 1_000;
const MAX_TEXT_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_TEXT_BYTES = 8 * 1024 * 1024;

export type SensitiveSeverity = "critical" | "high" | "medium";
export type SensitiveScanStatus = "clean" | "review_required" | "blocked";
export type SensitiveFinding = { category: string; severity: SensitiveSeverity; filePath: string; line?: number };
export type SensitiveDataScan = {
  status: SensitiveScanStatus;
  scannedFiles: number;
  skippedFiles: number;
  findings: SensitiveFinding[];
  warnings: string[];
};

type CentralEntry = { path: string; compressedSize: number; uncompressedSize: number; compression: number; localOffset: number };

const textFilePattern = /(^|\/)(\.env(?:\.[\w-]+)?|[^/]+\.(?:txt|md|json|ya?ml|toml|ini|conf|config|xml|properties|js|jsx|ts|tsx|mjs|cjs|py|java|kt|go|rb|php|cs|sh|bash|zsh|ps1|sql|graphql|env))$/i;
const sensitiveNamePattern = /(^|\/)(\.env(?:\.[\w-]+)?|id_rsa(?:\.pub)?|[^/]+\.(?:pem|key|p12|pfx|keystore)|credentials(?:\.json)?|service[-_]?account[^/]*\.json|\.npmrc|\.pypirc|\.netrc)$/i;

function readEntries(bytes: Uint8Array): CentralEntry[] {
  let endOffset = -1;
  const start = Math.max(0, bytes.length - 65_557);
  for (let index = bytes.length - 22; index >= start; index -= 1) {
    if (new DataView(bytes.buffer, bytes.byteOffset + index, 4).getUint32(0, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) { endOffset = index; break; }
  }
  if (endOffset < 0) throw new Error("تعذر الوصول إلى فهرس ZIP لفحص الأمان.");
  const end = new DataView(bytes.buffer, bytes.byteOffset + endOffset, bytes.length - endOffset);
  const count = end.getUint16(10, true);
  const directoryOffset = end.getUint32(16, true);
  if (count > MAX_SCANNED_ENTRIES || count === 0xffff || directoryOffset >= bytes.length) throw new Error("فهرس ZIP خارج حدود فحص الأمان.");
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const entries: CentralEntry[] = [];
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length) throw new Error("فهرس ZIP غير مكتمل.");
    const header = new DataView(bytes.buffer, bytes.byteOffset + cursor, bytes.length - cursor);
    if (header.getUint32(0, true) !== CENTRAL_DIRECTORY_SIGNATURE) throw new Error("فهرس ZIP غير صالح.");
    const nameLength = header.getUint16(28, true);
    const extraLength = header.getUint16(30, true);
    const commentLength = header.getUint16(32, true);
    const endOfEntry = cursor + 46 + nameLength + extraLength + commentLength;
    if (endOfEntry > bytes.length) throw new Error("سجل ZIP يتجاوز حد الأرشيف.");
    const path = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)).replace(/^\/+/, "");
    if (path && !path.endsWith("/") && !path.includes("\0")) entries.push({ path, compressedSize: header.getUint32(20, true), uncompressedSize: header.getUint32(24, true), compression: header.getUint16(10, true), localOffset: header.getUint32(42, true) });
    cursor = endOfEntry;
  }
  return entries;
}

function contentForEntry(bytes: Uint8Array, entry: CentralEntry) {
  if (entry.uncompressedSize > MAX_TEXT_FILE_BYTES) return null;
  if (entry.localOffset + 30 > bytes.length) return null;
  const local = new DataView(bytes.buffer, bytes.byteOffset + entry.localOffset, bytes.length - entry.localOffset);
  if (local.getUint32(0, true) !== LOCAL_FILE_SIGNATURE) return null;
  const start = entry.localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
  const end = start + entry.compressedSize;
  if (end > bytes.length) return null;
  const compressed = bytes.subarray(start, end);
  const output = entry.compression === 0 ? compressed : entry.compression === 8 ? inflateRawSync(compressed) : null;
  if (!output || output.length !== entry.uncompressedSize || output.length > MAX_TEXT_FILE_BYTES) return null;
  const sample = output.subarray(0, Math.min(output.length, 512));
  if (sample.includes(0)) return null;
  return new TextDecoder("utf-8", { fatal: false }).decode(output);
}

function lineFor(text: string, offset: number) {
  return text.slice(0, offset).split("\n").length;
}

function isPlaceholder(value: string) {
  return /^(\$\{|\$[A-Z_]|<|your[_-]?|example|sample|placeholder|changeme|replace[_-]?me|null|undefined)/i.test(value.trim());
}

function findingsForText(path: string, text: string) {
  const findings: SensitiveFinding[] = [];
  const addAll = (category: string, severity: SensitiveSeverity, pattern: RegExp) => {
    for (const match of text.matchAll(pattern)) findings.push({ category, severity, filePath: path, line: lineFor(text, match.index ?? 0) });
  };
  addAll("مفتاح خاص", "critical", /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/g);
  addAll("معرّف وصول AWS", "critical", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g);
  addAll("رمز GitHub", "critical", /\bgh[pousr]_[A-Za-z0-9_]{20,255}\b/g);
  addAll("مفتاح Stripe", "critical", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g);
  addAll("سلسلة اتصال تتضمن اعتماداً", "high", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s/:]+:[^\s@]+@/gi);
  addAll("رمز Bearer ثابت", "high", /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}\b/gi);
  const assignment = /(?:^|\n)\s*(?:export\s+)?(?:[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|API[_-]?KEY|PASSWORD|PRIVATE[_-]?KEY)[A-Z0-9_]*|(?:secret|token|api[_-]?key|password|private[_-]?key))\s*[:=]\s*["']?([^\s"'\n#]{8,})/gim;
  for (const match of text.matchAll(assignment)) {
    if (!isPlaceholder(match[1] ?? "")) findings.push({ category: "قيمة اعتماد معرفة في ملف", severity: "high", filePath: path, line: lineFor(text, match.index ?? 0) });
  }
  return findings;
}

export function scanProjectArchiveSensitiveData(bytes: Uint8Array): SensitiveDataScan {
  const findings: SensitiveFinding[] = [];
  const warnings: string[] = [];
  let scannedFiles = 0;
  let skippedFiles = 0;
  let totalTextBytes = 0;
  for (const entry of readEntries(bytes)) {
    const hasSensitiveName = sensitiveNamePattern.test(entry.path);
    if (hasSensitiveName) findings.push({ category: "ملف حساس ضمن الأرشيف", severity: "medium", filePath: entry.path });
    if (!textFilePattern.test(entry.path) && !hasSensitiveName) continue;
    if (totalTextBytes + entry.uncompressedSize > MAX_TOTAL_TEXT_BYTES) { skippedFiles += 1; warnings.push("توقّف فحص المحتوى بعد حد النصوص الآمن؛ راجع الملفات المتبقية محلياً قبل البناء."); continue; }
    try {
      const text = contentForEntry(bytes, entry);
      if (text === null) { skippedFiles += 1; continue; }
      scannedFiles += 1;
      totalTextBytes += new TextEncoder().encode(text).length;
      findings.push(...findingsForText(entry.path, text));
    } catch {
      skippedFiles += 1;
    }
  }
  const uniqueFindings = findings.filter((finding, index, values) => values.findIndex((candidate) => candidate.category === finding.category && candidate.filePath === finding.filePath && candidate.line === finding.line) === index).slice(0, 100);
  const status: SensitiveScanStatus = uniqueFindings.some((finding) => finding.severity === "critical" || finding.severity === "high") ? "blocked" : uniqueFindings.length || skippedFiles ? "review_required" : "clean";
  return { status, scannedFiles, skippedFiles, findings: uniqueFindings, warnings: [...new Set(warnings)] };
}

export function summarizeSensitiveDataScan(scan: SensitiveDataScan) {
  const counts = { critical: 0, high: 0, medium: 0 };
  for (const finding of scan.findings) counts[finding.severity] += 1;
  return JSON.stringify({ version: 1, status: scan.status, scannedFiles: scan.scannedFiles, skippedFiles: scan.skippedFiles, counts, findings: scan.findings, warnings: scan.warnings });
}
