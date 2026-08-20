export const managedWorkerPolicy = {
  mode: "managed_periodic_non_sensitive",
  intervalMs: 10_000,
  allowedOperations: ["reclaim_command_lease", "claim_dry_command", "create_dry_plan", "advance_dry_task_engine", "touch_heartbeat", "record_runtime_event"] as const,
  prohibitedCapabilities: ["docker", "shell", "git", "network_egress", "host_files", "workspace_read", "workspace_write", "secret_access", "deploy", "delete"] as const,
  requiresApprovalFor: ["code_execution", "workspace_change", "pull_request", "publish", "delete"] as const,
} as const;

export type ManagedWorkerOperation = (typeof managedWorkerPolicy.allowedOperations)[number];
export type ManagedWorkerForbiddenCapability = (typeof managedWorkerPolicy.prohibitedCapabilities)[number];

export function assertManagedWorkerOperation(operation: string): asserts operation is ManagedWorkerOperation {
  if (!(managedWorkerPolicy.allowedOperations as readonly string[]).includes(operation)) {
    throw new Error(`العامل المُدار لا يملك صلاحية العملية: ${operation}.`);
  }
}

export function getManagedWorkerBoundary() {
  return {
    mode: managedWorkerPolicy.mode,
    allowedOperations: [...managedWorkerPolicy.allowedOperations],
    prohibitedCapabilities: [...managedWorkerPolicy.prohibitedCapabilities],
    requiresApprovalFor: [...managedWorkerPolicy.requiresApprovalFor],
  };
}
