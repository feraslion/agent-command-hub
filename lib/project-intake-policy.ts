export const MAX_PROJECT_ARCHIVE_BYTES = 8 * 1024 * 1024;

export const buildTargetValues = ["web", "android", "ios", "node", "docker", "custom"] as const;
export type BuildTarget = (typeof buildTargetValues)[number];

const allowedRepositoryHosts = new Map([
  ["github.com", "github"],
  ["gitlab.com", "gitlab"],
  ["bitbucket.org", "bitbucket"],
]);

export class ProjectIntakePolicyError extends Error {}

export function validateZipArchive(input: { fileName: string; byteSize: number; bytes: Uint8Array }) {
  const fileName = input.fileName.trim();
  if (!fileName.toLowerCase().endsWith(".zip")) throw new ProjectIntakePolicyError("يجب أن يكون الملف أرشيف ZIP.");
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > MAX_PROJECT_ARCHIVE_BYTES) {
    throw new ProjectIntakePolicyError(`يجب ألا يتجاوز حجم الأرشيف ${MAX_PROJECT_ARCHIVE_BYTES / 1024 / 1024}MB.`);
  }
  if (input.bytes.length !== input.byteSize) throw new ProjectIntakePolicyError("حجم الأرشيف المعلن لا يطابق البيانات المرفوعة.");
  const header = [...input.bytes.subarray(0, 4)];
  const validHeader = header[0] === 0x50 && header[1] === 0x4b && ([0x03, 0x05, 0x07].includes(header[2] ?? -1)) && ([0x04, 0x06, 0x08].includes(header[3] ?? -1));
  if (!validHeader) throw new ProjectIntakePolicyError("لا يطابق الملف ترويسة ZIP صحيحة.");
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^[_ .-]+/, "").slice(0, 180);
  if (!safeName || safeName === ".zip") throw new ProjectIntakePolicyError("اسم الأرشيف غير صالح.");
  return { safeName, byteSize: input.byteSize };
}

export function validateRepositoryReference(input: { remoteUrl: string; repositoryName?: string; defaultBranch: string }) {
  let url: URL;
  try {
    url = new URL(input.remoteUrl.trim());
  } catch {
    throw new ProjectIntakePolicyError("رابط المستودع غير صالح.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) {
    throw new ProjectIntakePolicyError("استخدم رابط HTTPS عاماً للمستودع من دون بيانات اعتماد أو معاملات إضافية.");
  }
  const provider = allowedRepositoryHosts.get(url.hostname.toLowerCase());
  const pathParts = url.pathname.replace(/\.git$/i, "").split("/").filter(Boolean);
  if (!provider || pathParts.length < 2) {
    throw new ProjectIntakePolicyError("يدعم هذا الإصدار روابط GitHub أو GitLab أو Bitbucket العامة فقط.");
  }
  if ((provider === "github" || provider === "bitbucket") && pathParts.length !== 2) {
    throw new ProjectIntakePolicyError("يجب أن يكون رابط GitHub أو Bitbucket بصيغة المالك/المستودع فقط.");
  }
  const defaultBranch = input.defaultBranch.trim();
  if (!/^[A-Za-z0-9._/-]{1,128}$/.test(defaultBranch) || defaultBranch.includes("..")) {
    throw new ProjectIntakePolicyError("اسم الفرع الافتراضي غير صالح.");
  }
  const inferredName = pathParts.slice(-2).join("/");
  return {
    provider,
    remoteUrl: url.toString().replace(/\/$/, ""),
    repositoryName: input.repositoryName?.trim().slice(0, 255) || inferredName,
    defaultBranch,
  };
}

export function validateBuildRequest(input: { target: string; title: string; summary: string }) {
  if (!buildTargetValues.includes(input.target as BuildTarget)) throw new ProjectIntakePolicyError("هدف البناء غير مدعوم.");
  const title = input.title.trim();
  const summary = input.summary.trim();
  if (title.length < 3 || title.length > 255) throw new ProjectIntakePolicyError("عنوان طلب البناء يجب أن يكون بين 3 و255 حرفاً.");
  if (summary.length < 8 || summary.length > 4000) throw new ProjectIntakePolicyError("وصف طلب البناء يجب أن يكون بين 8 و4000 حرف.");
  return { target: input.target as BuildTarget, title, summary };
}
