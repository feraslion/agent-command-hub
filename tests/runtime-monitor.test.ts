import { describe, expect, it } from "vitest";

import { filterRuntimeRecords, getRuntimeEventType, getRuntimeSeverity, getRuntimeStats } from "../lib/runtime-monitor";

const records = [
  { request: { status: "completed" } },
  { request: { status: "claimed" } },
  { request: { status: "awaiting_approval" } },
  { request: { status: "failed" } },
  { request: { status: "blocked" } },
];

describe("runtime monitor helpers", () => {
  it("groups runtime records by the operational filters", () => {
    expect(filterRuntimeRecords(records, { status: "all", eventType: "all", severity: "all" })).toHaveLength(5);
    expect(filterRuntimeRecords(records, { status: "active", eventType: "all", severity: "all" }).map((record) => record.request.status)).toEqual(["claimed"]);
    expect(filterRuntimeRecords(records, { status: "attention", eventType: "all", severity: "all" }).map((record) => record.request.status)).toEqual(["awaiting_approval", "blocked"]);
    expect(filterRuntimeRecords(records, { status: "failed", eventType: "all", severity: "all" }).map((record) => record.request.status)).toEqual(["failed", "blocked"]);
  });

  it("combines event type and severity filters derived from the runtime request state", () => {
    expect(getRuntimeEventType("awaiting_approval")).toBe("approval");
    expect(getRuntimeEventType("environment_required")).toBe("environment");
    expect(getRuntimeEventType("blocked")).toBe("policy");
    expect(getRuntimeSeverity("claimed")).toBe("info");
    expect(getRuntimeSeverity("awaiting_approval")).toBe("warning");
    expect(getRuntimeSeverity("failed")).toBe("critical");
    expect(filterRuntimeRecords(records, { status: "all", eventType: "approval", severity: "warning" }).map((record) => record.request.status)).toEqual(["awaiting_approval"]);
    expect(filterRuntimeRecords(records, { status: "all", eventType: "policy", severity: "critical" }).map((record) => record.request.status)).toEqual(["blocked"]);
    expect(filterRuntimeRecords(records, { status: "active", eventType: "execution", severity: "info" }).map((record) => record.request.status)).toEqual(["claimed"]);
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
