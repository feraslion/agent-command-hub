import { describe, expect, it, vi } from "vitest";

import { runPlannerAgentExecution } from "../server/agent-execution-service";

const input = { projectId: 9, taskId: 4, contextPackageId: 3 };
const plannerOutput = {
  summary: "خطة قابلة للمراجعة لتحسين تدفق المخطط.",
  workPlanTitle: "خطة Planner تجريبية",
  stages: ["تثبيت النطاق"],
  openQuestions: [],
  acceptanceCriteria: ["وجود اقتراح مراجعة"],
  risks: [],
};

describe("runPlannerAgentExecution", () => {
  it("يشغل المخطط ثم يمرر مخرجاً مفسراً إلى سجل المراجعة", async () => {
    const operations = {
      createPlannerAgentExecutionForProject: vi.fn().mockResolvedValue({ execution: { id: 41 }, reused: false }),
      markPlannerAgentExecutionRunningForProject: vi.fn(),
      interpretPlannerAgentExecutionForProject: vi.fn().mockResolvedValue({ id: 41, status: "awaiting_review" }),
      failPlannerAgentExecutionForProject: vi.fn(),
    };
    const runModel = vi.fn().mockResolvedValue({ run: { id: 52 }, output: plannerOutput });

    const result = await runPlannerAgentExecution(7, input, operations, runModel);

    expect(result.execution.status).toBe("awaiting_review");
    expect(runModel).toHaveBeenCalledWith(7, { ...input, role: "planner" });
    expect(operations.interpretPlannerAgentExecutionForProject).toHaveBeenCalledWith(7, expect.objectContaining({ modelRunId: 52, interpretation: expect.objectContaining({ workPlan: expect.objectContaining({ status: "review" }) }) }));
    expect(operations.failPlannerAgentExecutionForProject).not.toHaveBeenCalled();
  });

  it("يعيد التنفيذ الموجود من دون استدعاء نموذج أو مفسر جديد", async () => {
    const operations = {
      createPlannerAgentExecutionForProject: vi.fn().mockResolvedValue({ execution: { id: 40, status: "awaiting_review" }, reused: true }),
      markPlannerAgentExecutionRunningForProject: vi.fn(),
      interpretPlannerAgentExecutionForProject: vi.fn(),
      failPlannerAgentExecutionForProject: vi.fn(),
    };
    const runModel = vi.fn();

    const result = await runPlannerAgentExecution(7, input, operations, runModel);

    expect(result.reused).toBe(true);
    expect(runModel).not.toHaveBeenCalled();
  });
});
