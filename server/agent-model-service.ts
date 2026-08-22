import * as db from "./db";
import { getApprovedModelSelection, invokeStructuredAgent } from "./agent-model-gateway";
import { redactAgentPromptText, summarizeAgentOutput, type AgentModelRole } from "../lib/agent-model-policy";
import { buildAgentOutputArtifact } from "../lib/agent-output-artifact";
import { buildAgentRunOwnerAlert } from "../lib/agent-run-alert";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";

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
    const outputSummary = summarizeAgentOutput(input.role, result.output);
    const completed = await db.settleAgentModelRunForProject(userId, {
      projectId: input.projectId,
      runId: prepared.run.id,
      outputJson: JSON.stringify(result.output),
      outputSummary,
      inputTokens: result.usage.prompt_tokens,
      outputTokens: result.usage.completion_tokens,
      durationMs: Date.now() - startedAt,
    });
    let artifact: Awaited<ReturnType<typeof db.registerArtifactForProject>> | null = null;
    let artifactWarning: string | null = null;
    try {
      const document = buildAgentOutputArtifact({ projectId: input.projectId, runId: prepared.run.id, role: input.role, model: selection.model, output: result.output, summary: outputSummary });
      const stored = await storagePut(`${userId}/${document.storagePath}`, document.content, "application/json");
      artifact = await db.registerArtifactForProject(userId, { projectId: input.projectId, taskId: input.taskId, name: document.name, kind: document.kind, reference: stored.key, summary: document.summary });
    } catch {
      artifactWarning = "اكتمل تشغيل النموذج، لكن تعذر حفظ ملف الدليل المنقح؛ المخرج المختصر ما زال مسجلاً في السجل.";
    }
    try {
      await notifyOwner(buildAgentRunOwnerAlert({ role: input.role, status: "completed", summary: outputSummary, artifactCreated: Boolean(artifact) }));
    } catch {
      // Owner alerts are advisory and must never change a settled model result.
    }
    return { run: completed, output: result.output, selection, artifact, artifactWarning };
  } catch (error) {
    const summary = redactAgentPromptText(error instanceof Error ? error.message : "Model gateway failed", 1_000);
    await db.failAgentModelRunForProject(userId, { projectId: input.projectId, runId: prepared.run.id, errorSummary: summary });
    try {
      await notifyOwner(buildAgentRunOwnerAlert({ role: input.role, status: "failed", summary }));
    } catch {
      // A delivery failure must not hide the original model error.
    }
    throw error;
  }
}
