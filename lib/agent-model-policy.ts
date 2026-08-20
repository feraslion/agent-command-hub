export const agentModelRoles = ["planner", "coder", "qa", "reviewer", "debugger"] as const;
export type AgentModelRole = (typeof agentModelRoles)[number];

export type ModelRolePolicy = {
  preferredModels: string[];
  reservationUsd: number;
  maxAttempts: number;
  authority: string;
};

export const modelRolePolicies: Record<AgentModelRole, ModelRolePolicy> = {
  planner: { preferredModels: ["gpt-5-mini", "gpt-5"], reservationUsd: 0.05, maxAttempts: 1, authority: "خطة وأسئلة ومعايير قبول منظمة فقط" },
  coder: { preferredModels: ["claude-sonnet-4-6", "gpt-5"], reservationUsd: 0.15, maxAttempts: 1, authority: "اقتراح فرق فقط؛ بلا كتابة Workspace أو تشغيل أو Git" },
  qa: { preferredModels: ["gpt-5-mini", "claude-haiku-4-5"], reservationUsd: 0.05, maxAttempts: 1, authority: "نتيجة PASS أو FAIL وأدلة وفجوات فقط" },
  reviewer: { preferredModels: ["gpt-5", "claude-sonnet-4-6"], reservationUsd: 0.1, maxAttempts: 1, authority: "تقييم نطاق ومخاطر وقرار مراجعة فقط" },
  debugger: { preferredModels: ["gpt-5", "claude-sonnet-4-6"], reservationUsd: 0.1, maxAttempts: 2, authority: "تشخيص وأصغر إصلاح مقترح؛ بلا تطبيق أو تشغيل" },
};

export function chooseModelForRole(role: AgentModelRole, availableModelIds: string[]) {
  const policy = modelRolePolicies[role];
  const model = policy.preferredModels.find((candidate) => availableModelIds.includes(candidate));
  if (!model) throw new Error(`No approved model is available for ${role}`);
  return { model, reservationUsd: policy.reservationUsd, maxAttempts: policy.maxAttempts, authority: policy.authority };
}

export function redactAgentPromptText(value: string, limit = 2_000): string {
  return value
    .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1: [محجوب]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function summarizeAgentOutput(role: AgentModelRole, output: Record<string, unknown>): string {
  const summary = typeof output.summary === "string" ? output.summary : typeof output.diagnosis === "string" ? output.diagnosis : "تم إنشاء مخرج منظم.";
  return `${role}: ${redactAgentPromptText(summary, 280)}`;
}
