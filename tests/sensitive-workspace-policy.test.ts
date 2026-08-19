import { describe, expect, it } from "vitest";
import { assessSensitiveWorkspaceChange } from "../lib/sensitive-workspace-policy";

describe("سياسة التعديل الحساس في Workspace", () => {
  it("يطلب مراجعة ثانوية عند إدخال صلاحية تشغيل أو بيانات اعتماد في source", () => {
    const result = assessSensitiveWorkspaceChange("source/runner.ts", "export const enabled = false", "export const token = process.env.API_TOKEN");
    expect(result.sensitive).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("لا يصنف التعديل العادي أو التوثيق كتعديل حساس", () => {
    expect(assessSensitiveWorkspaceChange("source/view.ts", "const count = 1", "const count = 2").sensitive).toBe(false);
    expect(assessSensitiveWorkspaceChange("docs/setup.md", "a", "token example").sensitive).toBe(false);
  });
});
