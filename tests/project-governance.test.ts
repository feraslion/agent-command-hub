import { describe, expect, it } from "vitest";

import { buildProjectReportDraft, estimateContextTokens, getCriticalPathTaskIds, normalizeContextSourceRefs, redactContextLabel, wouldCreateDependencyCycle } from "../lib/project-governance";

describe("project governance policy", () => {
  const edges = [{ taskId: 2, dependsOnTaskId: 1 }, { taskId: 3, dependsOnTaskId: 2 }];

  it("rejects a dependency that creates a cycle", () => {
    expect(wouldCreateDependencyCycle(1, 3, edges)).toBe(true);
    expect(wouldCreateDependencyCycle(4, 3, edges)).toBe(false);
    expect(wouldCreateDependencyCycle(1, 1, edges)).toBe(true);
  });

  it("returns the longest incomplete blocking chain", () => {
    expect(getCriticalPathTaskIds([
      { id: 1, status: "completed" },
      { id: 2, status: "running" },
      { id: 3, status: "pending" },
      { id: 4, status: "pending" },
    ], [...edges, { taskId: 4, dependsOnTaskId: 3 }])).toEqual([2, 3, 4]);
  });

  it("keeps context references bounded and metadata-only", () => {
    const refs = normalizeContextSourceRefs([
      { kind: "brief", id: 1, label: "موجز المشروع" },
      { kind: "brief", id: 1, label: "نسخة مكررة" },
      { kind: "task", id: 2, label: "مهمة التكامل" },
    ]);
    expect(refs).toHaveLength(2);
    expect(estimateContextTokens(refs)).toBeGreaterThan(0);
    expect(redactContextLabel("API_KEY=abc123 سجل التشغيل")).toContain("[محجوب]");
  });

  it("builds an honest blocked report from live evidence", () => {
    const report = buildProjectReportDraft({
      projectName: "المركز",
      projectStatus: "active",
      completedTaskTitles: ["الموجز"],
      blockedTaskTitles: ["اختبار Runner"],
      artifactNames: ["QA.md"],
      pendingApprovals: 1,
      kind: "blocked",
    });
    expect(report.nextStep).toContain("اختبار Runner");
    expect(report.riskSummary).toContain("1 موافقة معلقة");
  });
});
