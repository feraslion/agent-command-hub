import { describe, expect, it } from "vitest";
import { assertWorkspaceContent, normalizeWorkspacePath, WorkspacePathError } from "../server/workspace-policy";

describe("سياسة Workspace المقيدة", () => {
  it("تقبل ملفاً ضمن الأدلة الافتراضية المعتمدة", () => {
    expect(normalizeWorkspacePath("source/app/index.ts")).toBe("source/app/index.ts");
    expect(normalizeWorkspacePath("docs/architecture.md")).toBe("docs/architecture.md");
  });

  it("ترفض المسارات المطلقة ومسارات تجاوز Workspace", () => {
    expect(() => normalizeWorkspacePath("/etc/passwd")).toThrow(WorkspacePathError);
    expect(() => normalizeWorkspacePath("source/../../secret.txt")).toThrow(WorkspacePathError);
    expect(() => normalizeWorkspacePath("unknown/file.txt")).toThrow(WorkspacePathError);
  });

  it("تطبق الحد الأقصى الآمن لمحتوى الملف", () => {
    expect(assertWorkspaceContent("محتوى آمن")).toBe("محتوى آمن");
    expect(() => assertWorkspaceContent("x".repeat(64_001))).toThrow(WorkspacePathError);
  });
});
