import { redactAgentPromptText, type AgentModelRole } from "./agent-model-policy";

const MAX_ARRAY_ITEMS = 24;
const MAX_OBJECT_KEYS = 32;
const MAX_STRING_LENGTH = 6_000;

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactAgentPromptText(value, MAX_STRING_LENGTH);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, MAX_OBJECT_KEYS).map(([key, child]) => [key, redactValue(child)]));
  }
  return value;
}

export function buildAgentOutputArtifact(input: { projectId: number; runId: number; role: AgentModelRole; model: string; output: Record<string, unknown>; summary: string }) {
  const safeOutput = redactValue(input.output) as Record<string, unknown>;
  const safeSummary = redactAgentPromptText(input.summary, 600);
  return {
    storagePath: `agent-outputs/${input.projectId}/${input.runId}-${input.role}.json`,
    name: `مخرج ${input.role} المنقح #${input.runId}`,
    kind: "agent_model_output",
    summary: safeSummary,
    content: JSON.stringify({ schemaVersion: 1, runId: input.runId, role: input.role, model: redactAgentPromptText(input.model, 128), summary: safeSummary, output: safeOutput }, null, 2),
  };
}
