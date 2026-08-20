import { describe, expect, it } from "vitest";
import { getGitPrOnlyBoundary, validatePullRequestDraft } from "../lib/git-pr-policy";

describe("Git PR-only policy", () => {
  it("accepts a bounded Pull Request draft", () => {
    expect(validatePullRequestDraft({ projectId: 1, headBranch: "agenthub/runtime-search", baseBranch: "main", title: "تحسين Runtime", summary: "مراجعة فقط" })).toMatchObject({ baseBranch: "main" });
  });

  it("rejects equivalent or traversal-like branch names", () => {
    expect(() => validatePullRequestDraft({ projectId: 1, headBranch: "main", baseBranch: "main", title: "عنوان", summary: "" })).toThrow();
    expect(() => validatePullRequestDraft({ projectId: 1, headBranch: "../unsafe", baseBranch: "main", title: "عنوان", summary: "" })).toThrow();
  });

  it("keeps merge and push outside the allowed boundary", () => {
    const boundary = getGitPrOnlyBoundary();
    expect(boundary.allowed).not.toContain("merge");
    expect(boundary.blocked).toContain("force_push");
  });
});
