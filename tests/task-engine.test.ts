import { describe, expect, it, vi } from "vitest";
import { runTaskEngineForOwners } from "../server/task-engine";

describe("Task Engine", () => {
  it("يجمع نتائج التقدم والانتظار والحجب والإكمال من دورات المحرك", async () => {
    const operations = {
      listActiveTaskEngineRunsForOwners: vi.fn().mockResolvedValue([
        { ownerId: 1, run: { id: 11, projectId: 101 } },
        { ownerId: 1, run: { id: 12, projectId: 101 } },
        { ownerId: 2, run: { id: 13, projectId: 202 } },
        { ownerId: 2, run: { id: 14, projectId: 202 } },
      ]),
      advanceTaskEngineRunForProject: vi.fn()
        .mockResolvedValueOnce({ outcome: "auto_completed" })
        .mockResolvedValueOnce({ outcome: "waiting" })
        .mockResolvedValueOnce({ outcome: "blocked" })
        .mockResolvedValueOnce({ outcome: "completed" }),
    };

    const result = await runTaskEngineForOwners([1, 2], operations);

    expect(operations.advanceTaskEngineRunForProject).toHaveBeenCalledWith(1, { projectId: 101, runId: 11 });
    expect(result).toEqual({ advancedCount: 1, waitingCount: 1, blockedCount: 1, completedCount: 1 });
  });
});
