import * as engineDb from "./db";

type EngineOperations = Pick<typeof engineDb, "advanceTaskEngineRunForProject" | "listActiveTaskEngineRunsForOwners">;

export type TaskEngineTickResult = { advancedCount: number; blockedCount: number; waitingCount: number; completedCount: number };

export async function runTaskEngineForOwners(ownerIds: number[], operations: EngineOperations = engineDb): Promise<TaskEngineTickResult> {
  const activeRuns = await operations.listActiveTaskEngineRunsForOwners(ownerIds);
  const result: TaskEngineTickResult = { advancedCount: 0, blockedCount: 0, waitingCount: 0, completedCount: 0 };
  for (const { run, ownerId } of activeRuns) {
    const step = await operations.advanceTaskEngineRunForProject(ownerId, { projectId: run.projectId, runId: run.id });
    if (step.outcome === "blocked") result.blockedCount += 1;
    else if (step.outcome === "waiting") result.waitingCount += 1;
    else if (step.outcome === "completed") result.completedCount += 1;
    else if (step.outcome !== "terminal") result.advancedCount += 1;
  }
  return result;
}
