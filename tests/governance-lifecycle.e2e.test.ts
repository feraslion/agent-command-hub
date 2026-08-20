import { describe, expect, it } from "vitest";

import { modelRolePolicies, redactAgentPromptText } from "../lib/agent-model-policy";
import { buildProjectReportDraft, getCriticalPathTaskIds, normalizeContextSourceRefs } from "../lib/project-governance";
import { getOperationalHealth } from "../lib/runtime-health";
import { filterRuntimeRecords } from "../lib/runtime-monitor";

describe("governance lifecycle contract", () => {
  it("keeps the project → task → approval → workspace → runtime flow bounded and reviewable", () => {
    const tasks = [
      { id: 11, status: "in_progress", title: "تنفيذ فرق Workspace" },
      { id: 12, status: "todo", title: "اختبار QA" },
      { id: 13, status: "todo", title: "مراجعة التسليم" },
    ];
    const criticalPath = getCriticalPathTaskIds(tasks, [{ taskId: 12, dependsOnTaskId: 11 }, { taskId: 13, dependsOnTaskId: 12 }]);
    expect(criticalPath).toEqual([11, 12, 13]);

    const context = normalizeContextSourceRefs([
      { kind: "brief", id: 1, label: "الهدف: تحديث Runtime" },
      { kind: "task", id: 11, label: "فرق مقترح فقط؛ token=never-export" },
      { kind: "artifact", id: 9, label: "diff: src/runtime.ts" },
    ]);
    expect(context[1]?.label).toContain("[محجوب]");
    expect(modelRolePolicies.coder.authority).toContain("بلا كتابة Workspace");
    expect(redactAgentPromptText("api_key=do-not-leak")).toContain("[محجوب]");

    const runtime = [{ request: { status: "awaiting_approval", targetPath: "src/runtime.ts", reason: "قرار مالك مطلوب", createdAt: new Date() } }];
    expect(filterRuntimeRecords(runtime, { status: "attention", eventType: "approval", severity: "warning", search: "runtime", timeRange: "24h" })).toHaveLength(1);

    const health = getOperationalHealth({ queued: 0, activeLeases: 0, failedLast24h: 0, pendingApprovals: 1, readyRunners: 1, workerStatus: "ready", workerHeartbeatAt: new Date(), budgetPercent: 30 });
    expect(health.tone).toBe("warning");

    const report = buildProjectReportDraft({ projectName: "Agent Hub", projectStatus: "in_progress", completedTaskTitles: [], blockedTaskTitles: [], artifactNames: ["diff: src/runtime.ts"], pendingApprovals: 1, kind: "delivery" });
    expect(report.nextStep).toContain("الموافقات المعلقة");
  });
});
