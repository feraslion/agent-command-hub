const sensitiveValuePattern = /\b(token|secret|password|api[_-]?key|authorization)\s*[:=]\s*([^\s,;]+)/gi;
const urlCredentialPattern = /([?&](?:token|key|signature|authorization)=)[^&\s]+/gi;

export const runtimeRetentionPolicy = {
  runtimeOutputLimit: 8_000,
  exportOutputLimit: 1_500,
  runtimeLogRetentionDays: 30,
  artifactReferenceLimit: 512,
} as const;

export function redactOperationalText(value: string | null | undefined, limit: number = runtimeRetentionPolicy.exportOutputLimit) {
  if (!value) return "";
  return value
    .replace(sensitiveValuePattern, "$1: [محجوب]")
    .replace(urlCredentialPattern, "$1[محجوب]")
    .replace(/\u0000/g, "")
    .slice(0, limit)
    .trim();
}

type ExportRuntimeRecord = { request: { id: number; targetPath: string; status: string; reason: string; stdout?: string | null; stderr?: string | null; createdAt: Date | string; completedAt?: Date | string | null; exitCode?: number | null }; project: { code: string; name: string } };

export function buildRedactedRuntimeExport(records: ExportRuntimeRecord[]) {
  const rows = records.map((record) => ({
    id: record.request.id,
    project: `${record.project.code} · ${record.project.name}`,
    path: redactOperationalText(record.request.targetPath, 512),
    status: record.request.status,
    createdAt: new Date(record.request.createdAt).toISOString(),
    completedAt: record.request.completedAt ? new Date(record.request.completedAt).toISOString() : null,
    exitCode: record.request.exitCode ?? null,
    reason: redactOperationalText(record.request.reason),
    stdout: redactOperationalText(record.request.stdout),
    stderr: redactOperationalText(record.request.stderr),
  }));
  return JSON.stringify({ generatedAt: new Date().toISOString(), redaction: "حُجبت مفاتيح وأسرار محتملة وقُصت المخرجات.", records: rows }, null, 2);
}

export function buildRedactedArtifactExport(projectName: string, artifacts: Array<{ id: number; name: string; kind: string; storageKey: string; summary?: string | null; createdAt: Date | string }>) {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    project: redactOperationalText(projectName, 255),
    redaction: "حُجبت قيم الاعتماديات المحتملة وقُصت المراجع والملخصات.",
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      name: redactOperationalText(artifact.name, 255),
      kind: redactOperationalText(artifact.kind, 64),
      reference: redactOperationalText(artifact.storageKey, runtimeRetentionPolicy.artifactReferenceLimit),
      summary: redactOperationalText(artifact.summary),
      createdAt: new Date(artifact.createdAt).toISOString(),
    })),
  }, null, 2);
}
