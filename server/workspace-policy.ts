export const workspaceDirectoryNames = ["source", "docs", "tests", "artifacts", "memory", "logs"] as const;

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

export function normalizeWorkspacePath(value: string) {
  const path = value.trim().replaceAll("\\", "/");
  if (!path || path.length > 512) throw new WorkspacePathError("مسار Workspace فارغ أو يتجاوز الحد المسموح.");
  if (path.startsWith("/") || path.includes("\0") || path.split("/").includes("..") || path.includes("//")) {
    throw new WorkspacePathError("المسار خارج حدود Workspace.");
  }
  const [directory, ...rest] = path.split("/");
  if (!workspaceDirectoryNames.includes(directory as (typeof workspaceDirectoryNames)[number]) || rest.length === 0 || rest.some((segment) => !segment || segment === ".")) {
    throw new WorkspacePathError("يجب أن يبدأ المسار بدليل Workspace معتمد وأن يشير إلى ملف.");
  }
  return [directory, ...rest].join("/");
}

export function assertWorkspaceContent(value: string) {
  if (value.length > 64_000) throw new WorkspacePathError("محتوى الملف يتجاوز الحد الآمن لـ Workspace.");
  return value;
}
