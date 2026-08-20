export type PresentationTone = "success" | "primary" | "warning" | "error" | "muted";

export function getTaskStatusPresentation(status: string): { label: string; tone: PresentationTone } {
  if (status === "completed") return { label: "مكتمل", tone: "success" };
  if (status === "running") return { label: "قيد التنفيذ", tone: "primary" };
  if (status === "verifying") return { label: "قيد التحقق", tone: "warning" };
  if (status === "debugging") return { label: "قيد التشخيص", tone: "warning" };
  if (status === "retrying") return { label: "إعادة محاولة", tone: "warning" };
  if (status === "failed") return { label: "فشل", tone: "error" };
  if (status === "cancelled") return { label: "ملغى", tone: "error" };
  if (status === "queued") return { label: "في الطابور", tone: "muted" };
  return { label: "قيد التخطيط", tone: "muted" };
}

export function getProjectStatusPresentation(status: string): { label: string; tone: PresentationTone } {
  if (status === "completed") return { label: "مكتمل", tone: "success" };
  if (status === "active") return { label: "قيد التنفيذ", tone: "primary" };
  if (status === "paused") return { label: "متوقف مؤقتاً", tone: "warning" };
  if (status === "archived") return { label: "مؤرشف", tone: "muted" };
  return { label: "قيد التخطيط", tone: "muted" };
}

export function getTaskPriorityLabel(priority: string): string {
  return priority === "critical" ? "حرجة" : priority === "high" ? "عالية" : priority === "low" ? "منخفضة" : "متوسطة";
}

export function isActiveTaskStatus(status: string): boolean {
  return ["queued", "running", "debugging", "retrying"].includes(status);
}

export function getProjectTaskSnapshot(tasks: Array<{ status: string; stage: string }>) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const activeTask = tasks.find((task) => task.status === "running")
    ?? tasks.find((task) => task.status === "verifying")
    ?? tasks.find((task) => isActiveTaskStatus(task.status));
  return {
    total,
    completed,
    progress: total ? Math.round((completed / total) * 100) : 0,
    activeStage: activeTask?.stage ?? null,
  };
}

const stageLabels: Record<string, string> = {
  requirements: "المتطلبات",
  architecture: "المعمارية",
  design: "التصميم",
  build: "البناء",
  verification: "التحقق",
  review: "المراجعة",
  release: "التسليم",
};

const stageOrder = ["requirements", "architecture", "design", "build", "verification", "review", "release"];

export function getStageLabel(stage: string): string {
  return stageLabels[stage] ?? stage;
}

export function getProjectPipeline(tasks: Array<{ status: string; stage: string }>) {
  const grouped = new Map<string, Array<{ status: string }>>();
  for (const task of tasks) {
    grouped.set(task.stage, [...(grouped.get(task.stage) ?? []), task]);
  }
  const stages = [...grouped.keys()].sort((left, right) => {
    const leftIndex = stageOrder.indexOf(left);
    const rightIndex = stageOrder.indexOf(right);
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
  return stages.map((stage) => {
    const entries = grouped.get(stage) ?? [];
    const active = entries.some((task) => isActiveTaskStatus(task.status) || task.status === "verifying");
    const completed = entries.length > 0 && entries.every((task) => task.status === "completed");
    return {
      stage,
      label: getStageLabel(stage),
      status: active ? "نشط" : completed ? "مكتمل" : "قادم",
      active,
      completed,
    };
  });
}
