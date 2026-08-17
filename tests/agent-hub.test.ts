import { describe, expect, it } from "vitest";
import { approvalTone, getBudgetSummary, statusTone, type AgentStatus, type ProjectStatus, type TaskStatus } from "../lib/agent-hub";

describe("statusTone", () => {
  it("يعطي لون النجاح للحالات المكتملة والنشطة", () => {
    expect(statusTone("مكتمل" as TaskStatus)).toBe("success");
    expect(statusTone("نشط" as AgentStatus)).toBe("success");
  });

  it("يعطي لون التنفيذ للحالات قيد البناء", () => {
    expect(statusTone("قيد التنفيذ" as TaskStatus)).toBe("primary");
    expect(statusTone("قيد البناء" as ProjectStatus)).toBe("primary");
  });

  it("يبقي الحالات غير المنجزة بنبرة مناسبة", () => {
    expect(statusTone("مراجعة" as TaskStatus)).toBe("warning");
    expect(statusTone("محجوب" as TaskStatus)).toBe("error");
    expect(statusTone("قادم" as TaskStatus)).toBe("muted");
  });
});

describe("getBudgetSummary", () => {
  it("يحسب المنصرف والمتبقي ونسبة السقف", () => {
    const summary = getBudgetSummary([
      { id: "1", projectId: "p", taskId: "t", agent: "A", task: "T", model: "M", tokens: 10, duration: "1د", cost: 0.8 },
      { id: "2", projectId: "p", taskId: "t", agent: "B", task: "T", model: "M", tokens: 20, duration: "1د", cost: 0.45 },
    ], 2);

    expect(summary).toEqual({ spent: 1.25, remaining: 0.75, percent: 63 });
  });

  it("لا يتجاوز نسبة 100 عند تخطي سقف الميزانية", () => {
    const summary = getBudgetSummary([
      { id: "1", projectId: "p", taskId: "t", agent: "A", task: "T", model: "M", tokens: 10, duration: "1د", cost: 3 },
    ], 2);

    expect(summary.percent).toBe(100);
    expect(summary.remaining).toBe(0);
  });
});

describe("approvalTone", () => {
  it("يميز حالات الموافقة والرفض والانتظار", () => {
    expect(approvalTone("معتمد")).toBe("success");
    expect(approvalTone("قيد الانتظار")).toBe("warning");
    expect(approvalTone("مرفوض")).toBe("error");
  });
});
