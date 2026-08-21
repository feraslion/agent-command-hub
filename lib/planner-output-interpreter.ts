import { redactAgentPromptText } from "./agent-model-policy";

export type PlannerModelOutput = {
  summary: string;
  workPlanTitle: string;
  stages: string[];
  openQuestions: string[];
  acceptanceCriteria: string[];
  risks: string[];
};

export type PlannerInterpretation = {
  workPlan: {
    title: string;
    summary: string;
    status: "review";
  };
  artifact: {
    name: string;
    kind: "planner_proposal";
    summary: string;
  };
  reviewNotice: string;
};

function normalizeText(value: string, limit: number) {
  return redactAgentPromptText(value, limit).replace(/\s+/g, " ").trim();
}

function normalizeItems(items: string[], limit: number) {
  const seen = new Set<string>();
  return items
    .map((item) => normalizeText(item, 360))
    .filter((item) => item.length >= 2)
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function asList(title: string, items: string[]) {
  return items.length ? `${title}:\n${items.map((item) => `- ${item}`).join("\n")}` : `${title}: لا توجد عناصر مقترحة.`;
}

/**
 * تحول مخرج Planner الذي تحقق منه Zod إلى مسودة قابلة للمراجعة فقط.
 * لا تنشئ مهاماً ولا تعدل Workspace ولا تتخذ قرار اعتماد.
 */
export function interpretPlannerOutput(output: PlannerModelOutput): PlannerInterpretation {
  const title = normalizeText(output.workPlanTitle, 255);
  const summary = normalizeText(output.summary, 1_500);
  const stages = normalizeItems(output.stages, 12);
  const criteria = normalizeItems(output.acceptanceCriteria, 12);
  const questions = normalizeItems(output.openQuestions, 10);
  const risks = normalizeItems(output.risks, 10);

  if (title.length < 2) throw new Error("Planner proposal requires a reviewable work-plan title");
  if (summary.length < 2) throw new Error("Planner proposal requires a substantive summary");
  if (!stages.length) throw new Error("Planner proposal requires at least one planned stage");
  if (!criteria.length) throw new Error("Planner proposal requires at least one acceptance criterion");

  const workPlanSummary = [
    summary,
    asList("المراحل المقترحة", stages),
    asList("معايير القبول المقترحة", criteria),
    asList("الأسئلة المفتوحة", questions),
    asList("المخاطر المعلنة", risks),
  ].join("\n\n").slice(0, 7_800);

  return {
    workPlan: { title, summary: workPlanSummary, status: "review" },
    artifact: {
      name: `اقتراح Planner · ${title}`.slice(0, 255),
      kind: "planner_proposal",
      summary: `اقتراح منظم: ${stages.length} مراحل، ${criteria.length} معايير قبول، ${questions.length} أسئلة مفتوحة، و${risks.length} مخاطر.`,
    },
    reviewNotice: "اقتراح المخطط محفوظ للمراجعة فقط. لم تُنشأ مهام ولم تُطبق تغييرات أو أدوات تلقائياً.",
  };
}
