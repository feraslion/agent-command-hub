import { describe, expect, it } from "vitest";

import { filterRuntimeRecords, getRuntimeEventType, getRuntimeSeverity, getRuntimeStats, runtimeSavedFilters } from "../lib/runtime-monitor";
import { buildRedactedRuntimeExport, redactOperationalText } from "../lib/runtime-data-policy";
import { getOperationalHealth } from "../lib/runtime-health";

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

  it("filters by safe text search and exposes focused saved presets", () => {
    const richRecords = [
      { request: { status: "failed", targetPath: "src/server.ts", reason: "token=secret-value failed", createdAt: new Date() } },
      { request: { status: "completed", targetPath: "src/app.ts", reason: "done", createdAt: new Date() } },
    ];
    expect(filterRuntimeRecords(richRecords, { status: "all", eventType: "all", severity: "all", search: "server", timeRange: "24h" })).toHaveLength(1);
    expect(runtimeSavedFilters.map((preset) => preset.id)).toEqual(["all", "urgent", "decisions"]);
  });

  it("redacts credential-like values from exported operational records", () => {
    expect(redactOperationalText("API_KEY=abc123")).toContain("API_KEY: [محجوب]");
    const exported = buildRedactedRuntimeExport([{ request: { id: 1, targetPath: "src/a.ts", status: "failed", reason: "password=demo", stdout: "ok", stderr: "token=abc", createdAt: new Date(), exitCode: 1 }, project: { code: "HUB", name: "Hub" } }]);
    expect(exported).not.toContain("abc");
    expect(exported).toContain("[محجوب]");
  });

  it("marks stale leased work and recent failures as requiring intervention", () => {
    const health = getOperationalHealth({ queued: 0, activeLeases: 1, failedLast24h: 1, pendingApprovals: 0, readyRunners: 1, workerStatus: "awaiting_service", workerHeartbeatAt: null, budgetPercent: 44 });
    expect(health.tone).toBe("critical");
    expect(health.cards.find((card) => card.id === "failures")?.tone).toBe("critical");
  });
});
