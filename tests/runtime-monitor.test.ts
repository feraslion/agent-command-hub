import { describe, expect, it } from "vitest";

import { filterRuntimeRecords, getRuntimeStats } from "../lib/runtime-monitor";

const records = [
  { request: { status: "completed" } },
  { request: { status: "claimed" } },
  { request: { status: "awaiting_approval" } },
  { request: { status: "failed" } },
  { request: { status: "blocked" } },
];

describe("runtime monitor helpers", () => {
  it("groups runtime records by the operational filters", () => {
    expect(filterRuntimeRecords(records, "all")).toHaveLength(5);
    expect(filterRuntimeRecords(records, "active").map((record) => record.request.status)).toEqual(["claimed"]);
    expect(filterRuntimeRecords(records, "attention").map((record) => record.request.status)).toEqual(["awaiting_approval", "blocked"]);
    expect(filterRuntimeRecords(records, "failed").map((record) => record.request.status)).toEqual(["failed", "blocked"]);
  });

  it("summarizes runner readiness, pending approvals, and terminal results", () => {
    expect(getRuntimeStats(records, 2, ["ready", "offline", "ready"])).toEqual({
      active: 1,
      completed: 1,
      failed: 2,
      requiresAttention: 4,
      readyRunners: 2,
    });
  });
});
