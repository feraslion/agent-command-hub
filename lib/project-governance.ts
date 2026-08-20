export type DependencyEdge = { taskId: number; dependsOnTaskId: number };

export type ContextSourceRef = {
  kind: "brief" | "plan" | "task" | "artifact" | "event";
  id: number;
  label: string;
};

export function wouldCreateDependencyCycle(taskId: number, dependsOnTaskId: number, edges: DependencyEdge[]): boolean {
  if (taskId === dependsOnTaskId) return true;
  const visited = new Set<number>();
  const visit = (nodeId: number): boolean => {
    if (nodeId === taskId) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    return edges.filter((edge) => edge.taskId === nodeId).some((edge) => visit(edge.dependsOnTaskId));
  };
  return visit(dependsOnTaskId);
}

export function getCriticalPathTaskIds(tasks: Array<{ id: number; status: string }>, edges: DependencyEdge[]): number[] {
  const incompleteIds = new Set(tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled").map((task) => task.id));
  const dependencies = new Map<number, number[]>();
  for (const edge of edges) {
    if (!incompleteIds.has(edge.taskId) || !incompleteIds.has(edge.dependsOnTaskId)) continue;
    dependencies.set(edge.taskId, [...(dependencies.get(edge.taskId) ?? []), edge.dependsOnTaskId]);
  }
  const visiting = new Set<number>();
  const memo = new Map<number, number[]>();
  const longestChain = (taskId: number): number[] => {
    if (memo.has(taskId)) return memo.get(taskId)!;
    if (visiting.has(taskId)) return [];
    visiting.add(taskId);
    const candidates = dependencies.get(taskId) ?? [];
    const dependencyPath = candidates.map(longestChain).sort((left, right) => right.length - left.length)[0] ?? [];
    visiting.delete(taskId);
    const path = [...dependencyPath, taskId];
    memo.set(taskId, path);
    return path;
  };
  return [...incompleteIds].map(longestChain).sort((left, right) => right.length - left.length)[0] ?? [];
}

export function normalizeContextSourceRefs(sourceRefs: ContextSourceRef[], limit = 12): ContextSourceRef[] {
  const seen = new Set<string>();
  return sourceRefs.filter((source) => {
    const key = `${source.kind}:${source.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit).map((source) => ({ ...source, label: redactContextLabel(source.label) }));
}

export function redactContextLabel(value: string): string {
  return value
    .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1: [محجوب]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function estimateContextTokens(sourceRefs: ContextSourceRef[]): number {
  return sourceRefs.reduce((total, source) => total + Math.max(8, Math.ceil(source.label.length / 3)), 0);
}

export function buildProjectReportDraft(input: {
  projectName: string;
  projectStatus: string;
  completedTaskTitles: string[];
  blockedTaskTitles: string[];
  artifactNames: string[];
  pendingApprovals: number;
  kind: "delivery" | "blocked";
}) {
  const completed = input.completedTaskTitles.length ? input.completedTaskTitles.join("، ") : "لا توجد مهام مكتملة موثقة بعد";
  const evidence = input.artifactNames.length ? input.artifactNames.join("، ") : "لا توجد أدلة مسجلة بعد";
  const risks = [
    input.blockedTaskTitles.length ? `مهام محجوبة: ${input.blockedTaskTitles.join("، ")}` : "لا توجد مهام محجوبة مسجلة",
    input.pendingApprovals ? `${input.pendingApprovals} موافقة معلقة` : "لا توجد موافقات معلقة",
  ].join(". ");
  const blocked = input.blockedTaskTitles[0];
  return {
    summary: input.kind === "delivery"
      ? `تقرير تسليم ${input.projectName}: حالة المشروع الحالية ${input.projectStatus}.`
      : `تقرير إيقاف ${input.projectName}: يحتاج المشروع إلى معالجة عائق قبل المتابعة.`,
    completedWork: completed,
    evidenceSummary: evidence,
    riskSummary: risks,
    nextStep: input.kind === "delivery"
      ? input.pendingApprovals ? "حسم الموافقات المعلقة قبل إقرار التسليم." : "مراجعة الأدلة وإقرار التسليم أو فتح دورة متابعة جديدة."
      : blocked ? `معالجة المهمة المحجوبة: ${blocked}.` : "تحديد العائق التالي وتعيين مالكه قبل الاستئناف.",
  };
}
