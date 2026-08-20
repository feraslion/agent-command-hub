import { describe, expect, it } from "vitest";
import { isSensitiveOfflineAction, shouldCacheOfflineQuery } from "../lib/offline-read";

describe("offline read policy", () => {
  it("keeps only approved read models in the local cache", () => {
    expect(shouldCacheOfflineQuery([["projects", "list"], { type: "query" }])).toBe(true);
    expect(shouldCacheOfflineQuery([["tasks", "list"], { input: { projectId: 1 } }])).toBe(true);
    expect(shouldCacheOfflineQuery([["workspace", "writeFile"], { type: "mutation" }])).toBe(false);
  });

  it("marks state-changing actions as prohibited while offline", () => {
    expect(isSensitiveOfflineAction("approval")).toBe(true);
    expect(isSensitiveOfflineAction("workspace_write")).toBe(true);
    expect(isSensitiveOfflineAction("pull_request")).toBe(true);
  });
});
