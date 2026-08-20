export type RuntimeFilter = "all" | "active" | "attention" | "failed";

export type RuntimeMonitorRecord = {
  request: {
    status: string;
  };
};

const activeStatuses = new Set(["queued", "claimed"]);
const attentionStatuses = new Set(["awaiting_approval", "environment_required", "blocked"]);
const failedStatuses = new Set(["failed", "cancelled", "blocked"]);

export function filterRuntimeRecords<T extends RuntimeMonitorRecord>(records: T[], filter: RuntimeFilter): T[] {
  if (filter === "all") return records;
  if (filter === "active") return records.filter((record) => activeStatuses.has(record.request.status));
  if (filter === "attention") return records.filter((record) => attentionStatuses.has(record.request.status));
  return records.filter((record) => failedStatuses.has(record.request.status));
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
