import { describe, expect, it } from "vitest";

import { buildOwnerOperationalDigest } from "../lib/operational-owner-digest";

describe("operational owner digest", () => {
  it("highlights operational attention without proposing execution", () => {
    const digest = buildOwnerOperationalDigest({ queued: 2, activeLeases: 1, failedLast24h: 1, pendingApprovals: 3, readyRunners: 0, workerStatus: "offline", workerHeartbeatAt: null, budgetPercent: 100 });
    expect(digest.needsAttention).toBe(true);
    expect(digest.title).toContain("يحتاج مراجعة");
    expect(digest.content).toContain("لا يشغّل Runner");
  });

  it("reports a healthy read-only summary", () => {
    const digest = buildOwnerOperationalDigest({ queued: 0, activeLeases: 0, failedLast24h: 0, pendingApprovals: 0, readyRunners: 1, workerStatus: "ready", workerHeartbeatAt: "2026-08-22T08:00:00.000Z", budgetPercent: 15 });
    expect(digest.needsAttention).toBe(false);
    expect(digest.title).toContain("Agent Command Hub");
  });
});
