import * as db from "./db";
import { getApprovedModelSelection, invokeStructuredAgent } from "./agent-model-gateway";
import { redactAgentPromptText, summarizeAgentOutput, type AgentModelRole } from "../lib/agent-model-policy";

type SourceReference = { label?: string };

function parseSourceLabels(value: string): string[] {
  try {
    const sources = JSON.parse(value) as SourceReference[];
    return Array.isArray(sources) ? sources.map((source) => typeof source.label === "string" ? source.label : "مرجع منقح").slice(0, 12) : [];
  } catch {
    return [];
  }
}

export async function runGovernedAgentRole(userId: number, input: { projectId: number; taskId?: number; contextPackageId: number; role: AgentModelRole }) {
  const context = await db.getAgentModelRunContextForProject(userId, input);
  const selection = await getApprovedModelSelection(input.role);
  const inputSummary = `سياق منقح: ${context.contextPackage.title} · ${parseSourceLabels(context.contextPackage.sourceRefs).length} مراجع · ${selection.authority}`;
  const prepared = await db.reserveAgentModelRunForProject(userId, {
    ...input,
    model: selection.model,
    reservationAmount: selection.reservationUsd,
    inputSummary,
  });
  const startedAt = Date.now();
  try {
    await db.markAgentModelRunRunning(userId, { projectId: input.projectId, runId: prepared.run.id });
    const result = await invokeStructuredAgent(input.role, selection.model, {
      projectName: context.project.name,
      taskTitle: context.task?.title,
      taskDescription: context.task?.description ?? undefined,
      packageTitle: context.contextPackage.title,
      sourceRefs: parseSourceLabels(context.contextPackage.sourceRefs),
      brief: context.brief ? {
        goal: context.brief.goal,
        scope: context.brief.scope,
        constraints: context.brief.constraints,
        openQuestions: context.brief.openQuestions,
        risks: context.brief.risks,
      } : undefined,
    });
    const completed = await db.settleAgentModelRunForProject(userId, {
      projectId: input.projectId,
      runId: prepared.run.id,
      outputJson: JSON.stringify(result.output),
      outputSummary: summarizeAgentOutput(input.role, result.output),
      inputTokens: result.usage.prompt_tokens,
      outputTokens: result.usage.completion_tokens,
      durationMs: Date.now() - startedAt,
    });
    return { run: completed, output: result.output, selection };
  } catch (error) {
    const summary = redactAgentPromptText(error instanceof Error ? error.message : "Model gateway failed", 1_000);
    await db.failAgentModelRunForProject(userId, { projectId: input.projectId, runId: prepared.run.id, errorSummary: summary });
    throw error;
  }
}
