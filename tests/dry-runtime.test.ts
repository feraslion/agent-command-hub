import { describe, expect, it, vi } from "vitest";
import { buildDryRuntimePlan, runDryRuntimeTick } from "../server/dry-runtime";

describe("Runtime الجاف", () => {
  it("يبني خطة مشروع تضم بوابات المراجعة والموافقة من دون أدوات تنفيذ", () => {
    const plan = buildDryRuntimePlan({ id: 7, projectId: 3, taskId: null, command: "run_project", payload: "راجع نطاق النسخة الأولى" });

    expect(plan.steps).toHaveLength(6);
    expect(plan.steps.at(-1)).toMatchObject({ agent: "Release", approval: "approval" });
    expect(plan.constraints.join(" ")).toContain("لا يُشغّل Runtime الجاف shell");
  });

  it("ينشئ خطة واحدة لكل أمر محجوز ويجدد حجزها", async () => {
    const operations = {
      listClaimedCommandsForDryRuntime: vi.fn().mockResolvedValue([{ ownerId: 11, command: { id: 71, projectId: 8, taskId: null, command: "run_project", payload: null } }]),
      createDryExecutionPlanForClaim: vi.fn().mockResolvedValue({ created: true, plan: { id: 9 } }),
      renewDryCommandLease: vi.fn().mockResolvedValue(true),
    };
    const runEngine = vi.fn().mockResolvedValue({ advancedCount: 1 });

    const result = await runDryRuntimeTick("dry-worker-test", [11], operations, runEngine);

    expect(operations.createDryExecutionPlanForClaim).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 11, commandId: 71, workerId: "dry-worker-test" }));
    expect(operations.renewDryCommandLease).toHaveBeenCalledWith(71, "dry-worker-test");
    expect(runEngine).toHaveBeenCalledWith([11]);
    expect(result).toEqual({ observedClaimCount: 1, createdPlanCount: 1 });
  });
});
