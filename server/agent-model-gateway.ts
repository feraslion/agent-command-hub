import { z } from "zod";

import { invokeLLM, listLLMModels } from "./_core/llm";
import { chooseModelForRole, redactAgentPromptText, type AgentModelRole } from "../lib/agent-model-policy";

const baseObject = (properties: Record<string, unknown>, required: string[]) => ({ type: "object", properties, required, additionalProperties: false });
const stringArray = { type: "array", items: { type: "string" } };

const outputSchemas = {
  planner: baseObject({ summary: { type: "string" }, workPlanTitle: { type: "string" }, stages: stringArray, openQuestions: stringArray, acceptanceCriteria: stringArray, risks: stringArray }, ["summary", "workPlanTitle", "stages", "openQuestions", "acceptanceCriteria", "risks"]),
  coder: baseObject({ summary: { type: "string" }, targetPath: { type: "string" }, proposedDiff: { type: "string" }, assumptions: stringArray, risks: stringArray }, ["summary", "targetPath", "proposedDiff", "assumptions", "risks"]),
  qa: baseObject({ verdict: { type: "string", enum: ["PASS", "FAIL"] }, summary: { type: "string" }, evidence: stringArray, failedCriteria: stringArray, nextAction: { type: "string" } }, ["verdict", "summary", "evidence", "failedCriteria", "nextAction"]),
  reviewer: baseObject({ decision: { type: "string", enum: ["review", "approve_with_caution", "request_revision"] }, summary: { type: "string" }, risks: stringArray, scopeAssessment: { type: "string" }, requiredApprovals: stringArray }, ["decision", "summary", "risks", "scopeAssessment", "requiredApprovals"]),
  debugger: baseObject({ diagnosis: { type: "string" }, smallestSafeFix: { type: "string" }, retryRecommended: { type: "boolean" }, evidenceNeeded: stringArray, stopReason: { type: "string" } }, ["diagnosis", "smallestSafeFix", "retryRecommended", "evidenceNeeded", "stopReason"]),
} as const;

const outputParsers = {
  planner: z.object({ summary: z.string(), workPlanTitle: z.string(), stages: z.array(z.string()), openQuestions: z.array(z.string()), acceptanceCriteria: z.array(z.string()), risks: z.array(z.string()) }),
  coder: z.object({ summary: z.string(), targetPath: z.string(), proposedDiff: z.string(), assumptions: z.array(z.string()), risks: z.array(z.string()) }),
  qa: z.object({ verdict: z.enum(["PASS", "FAIL"]), summary: z.string(), evidence: z.array(z.string()), failedCriteria: z.array(z.string()), nextAction: z.string() }),
  reviewer: z.object({ decision: z.enum(["review", "approve_with_caution", "request_revision"]), summary: z.string(), risks: z.array(z.string()), scopeAssessment: z.string(), requiredApprovals: z.array(z.string()) }),
  debugger: z.object({ diagnosis: z.string(), smallestSafeFix: z.string(), retryRecommended: z.boolean(), evidenceNeeded: z.array(z.string()), stopReason: z.string() }),
} as const;

export type AgentPromptContext = {
  projectName: string;
  taskTitle?: string;
  taskDescription?: string;
  packageTitle: string;
  sourceRefs: string[];
  brief?: { goal: string; scope: string; constraints: string; openQuestions: string; risks: string };
};

const roleDirectives: Record<AgentModelRole, string> = {
  planner: "اقترح خطة قابلة للمراجعة فقط. لا تنفذ أوامر ولا تدّعِ أن أي خطوة نُفذت.",
  coder: "اقترح فرقاً نصياً فقط. لا تكتب في Workspace ولا تطلب تشغيل أدوات أو Git. إذا غاب السياق البرمجي، صرّح بالافتراضات.",
  qa: "قيّم الأدلة المتاحة فقط. لا تغيّر حالة مهمة ولا تنفذ اختباراً؛ أعد PASS أو FAIL مع ما يلزم لإثبات الحكم.",
  reviewer: "راجع المخاطر والنطاق فقط. لا تعتمد أو تطبق التعديل؛ اذكر الموافقات المطلوبة بوضوح.",
  debugger: "شخّص بأقل اقتراح إصلاح آمن. لا تطبق أو تشغّل شيئاً، وأوقف التكرار إذا غاب الدليل الكافي.",
};

function asText(content: string | Array<{ type: "text"; text: string } | unknown>): string {
  if (typeof content === "string") return content;
  return content.filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && "type" in part && (part as { type?: string }).type === "text" && "text" in part)).map((part) => part.text).join("\n");
}

export async function getApprovedModelSelection(role: AgentModelRole) {
  const catalog = await listLLMModels();
  return chooseModelForRole(role, catalog.data.map((model) => model.id));
}

export function validateAgentModelOutput(role: AgentModelRole, value: unknown) {
  return outputParsers[role].parse(value);
}

export async function invokeStructuredAgent(role: AgentModelRole, model: string, context: AgentPromptContext) {
  const safeContext = {
    projectName: redactAgentPromptText(context.projectName, 180),
    taskTitle: context.taskTitle ? redactAgentPromptText(context.taskTitle, 255) : undefined,
    taskDescription: context.taskDescription ? redactAgentPromptText(context.taskDescription, 2_000) : undefined,
    packageTitle: redactAgentPromptText(context.packageTitle, 255),
    sourceRefs: context.sourceRefs.map((source) => redactAgentPromptText(source, 180)).slice(0, 12),
    brief: context.brief ? {
      goal: redactAgentPromptText(context.brief.goal, 1_200),
      scope: redactAgentPromptText(context.brief.scope, 1_200),
      constraints: redactAgentPromptText(context.brief.constraints, 1_200),
      openQuestions: redactAgentPromptText(context.brief.openQuestions, 1_200),
      risks: redactAgentPromptText(context.brief.risks, 1_200),
    } : undefined,
  };
  const response = await invokeLLM({
    model,
    maxTokens: 2_400,
    messages: [
      { role: "system", content: `أنت دور ${role} داخل Agent Command Hub. ${roleDirectives[role]} أعد JSON فقط مطابقاً للمخطط.` },
      { role: "user", content: JSON.stringify(safeContext) },
    ],
    response_format: { type: "json_schema", json_schema: { name: `${role}_result`, strict: true, schema: outputSchemas[role] } },
  });
  const raw = asText(response.choices[0]?.message.content ?? "");
  if (!raw) throw new Error("Model returned no structured content");
  const parsed = validateAgentModelOutput(role, JSON.parse(raw));
  return { output: parsed, usage: response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
}
