import { describe, expect, it } from "vitest";
import { buildLineDiff, languageFromPath, summarizeDiff, tokenizeCodeLine } from "../lib/workspace-editor";

describe("محرر Workspace", () => {
  it("يتعرف على الامتدادات البرمجية ويبرز الكلمات الأساسية", () => {
    expect(languageFromPath("source/agent.ts")).toBe("typescript");
    expect(tokenizeCodeLine("const total = 2", "typescript").some((token) => token.kind === "keyword" && token.value === "const")).toBe(true);
  });

  it("يبني فرقاً سطرياً يوضح الإضافة والحذف قبل الحفظ", () => {
    const diff = buildLineDiff("one\ntwo", "one\nthree");
    expect(summarizeDiff(diff)).toEqual({ added: 1, removed: 1, changed: true });
  });
});
