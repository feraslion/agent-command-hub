export type PlannerTaskDraft = {
  title: string;
  description: string;
  stage: string;
  priority: "low" | "medium" | "high" | "critical";
  acceptanceCriteria: string[];
};

function sectionItems(summary: string, heading: string) {
  const block = summary.split(/\n\s*\n/).find((part) => part.trim().startsWith(`${heading}:`));
  if (!block) return [];
  return block
    .split("\n")
    .slice(1)
    .map((line) => line.replace(/^\s*-\s*/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 2)
    .slice(0, 12);
}

/**
 * يبني مسودات مهام من الأقسام التي كتبها Output Interpreter داخل خطة Planner.
 * لا ينشئ صفوف tasks ولا ينفذ أدوات؛ المستهلك هو من يقرر حفظ المسودات أو تطبيقها.
 */
export function buildPlannerTaskProposals(input: { planTitle: string; planSummary: string }): PlannerTaskDraft[] {
  const stages = sectionItems(input.planSummary, "المراحل المقترحة");
  const criteria = sectionItems(input.planSummary, "معايير القبول المقترحة");
  const narrative = input.planSummary.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim().slice(0, 1_000) ?? "";
  if (!stages.length) throw new Error("Approved Planner work plan does not contain reviewable stages");
  if (!criteria.length) throw new Error("Approved Planner work plan does not contain acceptance criteria");

  return stages.map((stage, index) => ({
    title: stage.slice(0, 255),
    description: `${input.planTitle}: ${narrative}`.slice(0, 4_000),
    stage: "planning",
    priority: index === 0 ? "high" : "medium",
    acceptanceCriteria: criteria.length === 1 ? criteria : [criteria[Math.min(index, criteria.length - 1)]],
  }));
}

export function parsePlannerProposalCriteria(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 12)
      : [];
  } catch {
    return [];
  }
}
