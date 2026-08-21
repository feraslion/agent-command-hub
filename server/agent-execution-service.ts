import {
  createPlannerAgentExecutionForProject,
  failPlannerAgentExecutionForProject,
  interpretPlannerAgentExecutionForProject,
  markPlannerAgentExecutionRunningForProject,
} from "./db";
import { runGovernedAgentRole } from "./agent-model-service";
import { redactAgentPromptText } from "../lib/agent-model-policy";
import { interpretPlannerOutput, type PlannerModelOutput } from "../lib/planner-output-interpreter";

type PlannerInput = { projectId: number; taskId?: number; contextPackageId: number };

type PlannerExecutionRecord = { id: number; status?: string };

type PlannerOperations = {
  createPlannerAgentExecutionForProject: (userId: number, input: PlannerInput) => Promise<{ execution: PlannerExecutionRecord; reused: boolean }>;
  markPlannerAgentExecutionRunningForProject: (userId: number, input: { projectId: number; executionId: number }) => Promise<unknown>;
  interpretPlannerAgentExecutionForProject: (userId: number, input: { projectId: number; executionId: number; modelRunId: number; interpretation: ReturnType<typeof interpretPlannerOutput> }) => Promise<PlannerExecutionRecord>;
  failPlannerAgentExecutionForProject: (userId: number, input: { projectId: number; executionId: number; errorSummary: string }) => Promise<unknown>;
};

type ModelRunner = (userId: number, input: PlannerInput & { role: "planner" }) => Promise<{ run: { id: number }; output: PlannerModelOutput }>;

const defaultPlannerOperations: PlannerOperations = {
  createPlannerAgentExecutionForProject,
  markPlannerAgentExecutionRunningForProject,
  interpretPlannerAgentExecutionForProject,
  failPlannerAgentExecutionForProject,
};

export async function runPlannerAgentExecution(
  userId: number,
  input: PlannerInput,
  operations: PlannerOperations = defaultPlannerOperations,
  runModel: ModelRunner = runGovernedAgentRole as ModelRunner,
) {
  const prepared = await operations.createPlannerAgentExecutionForProject(userId, input);
  if (prepared.reused) return { execution: prepared.execution, reused: true as const };

  try {
    await operations.markPlannerAgentExecutionRunningForProject(userId, { projectId: input.projectId, executionId: prepared.execution.id });
    const modelResult = await runModel(userId, { ...input, role: "planner" });
    const interpretation = interpretPlannerOutput(modelResult.output);
    const execution = await operations.interpretPlannerAgentExecutionForProject(userId, {
      projectId: input.projectId,
      executionId: prepared.execution.id,
      modelRunId: modelResult.run.id,
      interpretation,
    });
    return { execution, interpretation, reused: false as const };
  } catch (error) {
    const summary = redactAgentPromptText(error instanceof Error ? error.message : "Planner execution failed", 1_000);
    await operations.failPlannerAgentExecutionForProject(userId, { projectId: input.projectId, executionId: prepared.execution.id, errorSummary: summary });
    throw error;
  }
}
