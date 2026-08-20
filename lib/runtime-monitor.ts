export type RuntimeFilter = "all" | "active" | "attention" | "failed";
export type RuntimeEventType = "all" | "execution" | "approval" | "environment" | "policy";
export type RuntimeSeverity = "all" | "info" | "warning" | "critical";

export type RuntimeLogFilters = {
  status: RuntimeFilter;
  eventType: RuntimeEventType;
  severity: RuntimeSeverity;
};

export type RuntimeMonitorRecord = {
  request: {
    status: string;
  };
};

const activeStatuses = new Set(["queued", "claimed"]);
const attentionStatuses = new Set(["awaiting_approval", "environment_required", "blocked"]);
const failedStatuses = new Set(["failed", "cancelled", "blocked"]);

/**
 * يشتق تصنيف الحدث من حالة طلب Runtime الحالية؛ لا يضيف بيانات تشغيلية
 * جديدة ولا يغير سجل التنفيذ الدائم.
 */
export function getRuntimeEventType(status: string): Exclude<RuntimeEventType, "all"> {
  if (status === "awaiting_approval" || status === "approved") return "approval";
  if (status === "environment_required") return "environment";
  if (status === "blocked") return "policy";
  return "execution";
}

/** تحدد الأهمية كي يمكن عزل المشاكل دون إخفاء السجل التشغيلي المعتاد. */
export function getRuntimeSeverity(status: string): Exclude<RuntimeSeverity, "all"> {
  if (status === "failed" || status === "blocked") return "critical";
  if (status === "awaiting_approval" || status === "environment_required") return "warning";
  return "info";
}

export function filterRuntimeRecords<T extends RuntimeMonitorRecord>(records: T[], filters: RuntimeLogFilters): T[] {
  return records.filter((record) => {
    const { status } = record.request;
    const matchesStatus = filters.status === "all"
      || (filters.status === "active" && activeStatuses.has(status))
      || (filters.status === "attention" && attentionStatuses.has(status))
      || (filters.status === "failed" && failedStatuses.has(status));
    const matchesEventType = filters.eventType === "all" || getRuntimeEventType(status) === filters.eventType;
    const matchesSeverity = filters.severity === "all" || getRuntimeSeverity(status) === filters.severity;

    return matchesStatus && matchesEventType && matchesSeverity;
  });
}

export function getRuntimeStats<T extends RuntimeMonitorRecord>(records: T[], pendingApprovals: number, runnerStatuses: string[]) {
  return {
    active: records.filter((record) => activeStatuses.has(record.request.status)).length,
    completed: records.filter((record) => record.request.status === "completed").length,
    failed: records.filter((record) => failedStatuses.has(record.request.status)).length,
    requiresAttention: records.filter((record) => attentionStatuses.has(record.request.status)).length + pendingApprovals,
    readyRunners: runnerStatuses.filter((status) => status === "ready").length,
  };
}
