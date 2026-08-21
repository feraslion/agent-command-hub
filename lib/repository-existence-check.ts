import { validateRepositoryReference } from "./project-intake-policy";

type RepositoryReference = ReturnType<typeof validateRepositoryReference>;
type PublicFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type RepositoryExistenceResult = {
  provider: string;
  status: "found" | "not_found" | "restricted" | "unavailable";
  checkedAt: string;
  message: string;
};

export function repositoryPublicApiUrl(reference: RepositoryReference) {
  const parts = new URL(reference.remoteUrl).pathname.replace(/\.git$/i, "").split("/").filter(Boolean);
  if (reference.provider === "github") return `https://api.github.com/repos/${encodeURIComponent(parts[0] ?? "")}/${encodeURIComponent(parts[1] ?? "")}`;
  if (reference.provider === "gitlab") return `https://gitlab.com/api/v4/projects/${encodeURIComponent(parts.join("/"))}`;
  return `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(parts[0] ?? "")}/${encodeURIComponent(parts[1] ?? "")}`;
}

export async function verifyPublicRepository(input: { remoteUrl: string; defaultBranch: string }, fetcher: PublicFetch = fetch): Promise<RepositoryExistenceResult> {
  const reference = validateRepositoryReference(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetcher(repositoryPublicApiUrl(reference), {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "AgentCommandHub-RepositoryCheck/1.0" },
      redirect: "error",
      signal: controller.signal,
    });
    const checkedAt = new Date().toISOString();
    if (response.status === 200) return { provider: reference.provider, status: "found", checkedAt, message: "تم العثور على المستودع العام. لم يُستنسخ ولم تُقرأ ملفاته." };
    if (response.status === 404) return { provider: reference.provider, status: "not_found", checkedAt, message: "لم يُعثر على مستودع عام بهذا الرابط." };
    if (response.status === 401 || response.status === 403) return { provider: reference.provider, status: "restricted", checkedAt, message: "تعذر التحقق من مستودع خاص أو مقيّد من دون بيانات اعتماد." };
    return { provider: reference.provider, status: "unavailable", checkedAt, message: `خدمة المنصة غير متاحة للتحقق الآن (HTTP ${response.status}).` };
  } catch {
    return { provider: reference.provider, status: "unavailable", checkedAt: new Date().toISOString(), message: "تعذر الوصول إلى واجهة المنصة ضمن مهلة الفحص." };
  } finally {
    clearTimeout(timeout);
  }
}
