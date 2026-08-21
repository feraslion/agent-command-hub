export type RepositoryPreview = {
  provider: "github" | "gitlab";
  iconName: "github" | "gitlab";
  platformLabel: "GitHub" | "GitLab";
  repositoryName: string;
  namespace: string;
  normalizedUrl: string;
};

export type RepositoryPreviewResult =
  | { state: "empty" }
  | { state: "ready"; preview: RepositoryPreview }
  | { state: "invalid"; message: string };

const providers = {
  "github.com": { provider: "github", iconName: "github", platformLabel: "GitHub" },
  "gitlab.com": { provider: "gitlab", iconName: "gitlab", platformLabel: "GitLab" },
} as const;

export function previewRepositoryUrl(value: string): RepositoryPreviewResult {
  const raw = value.trim();
  if (!raw) return { state: "empty" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { state: "invalid", message: "أدخل رابط HTTPS كاملاً للمستودع." };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) {
    return { state: "invalid", message: "استخدم رابط HTTPS بلا بيانات اعتماد أو معاملات إضافية." };
  }
  const provider = providers[url.hostname.toLowerCase() as keyof typeof providers];
  if (!provider) return { state: "invalid", message: "تدعم المعاينة الفورية GitHub وGitLab فقط." };
  const parts = url.pathname.replace(/\.git$/i, "").split("/").filter(Boolean);
  if (parts.length < 2) return { state: "invalid", message: "أدخل رابطاً يتضمن المالك واسم المستودع." };
  const repositoryName = parts.at(-1) ?? "";
  const namespace = parts.slice(0, -1).join("/");
  if (!repositoryName || !namespace) return { state: "invalid", message: "تعذر استخراج اسم المستودع من الرابط." };
  url.pathname = url.pathname.replace(/\.git$/i, "");
  return {
    state: "ready",
    preview: {
      ...provider,
      repositoryName,
      namespace,
      normalizedUrl: url.toString().replace(/\/$/, ""),
    },
  };
}
