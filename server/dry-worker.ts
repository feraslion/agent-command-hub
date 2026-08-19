import * as workerDb from "./db";

export const DRY_WORKER_INTERVAL_MS = 10_000;
export const DRY_WORKER_LEASE_TIMEOUT_MS = 45_000;

type DryWorkerOperations = Pick<typeof workerDb, "claimNextDryCommand" | "listEnabledWorkerOwners" | "reclaimExpiredCommandLeases" | "touchWorkerHeartbeat">;

export type DryWorkerTickResult = {
  claimedCommandCount: number;
  enabledOwnerCount: number;
  recoveredLeaseCount: number;
  failedLeaseCount: number;
  ranAt: Date;
};

let lastDryWorkerTick: DryWorkerTickResult | null = null;

export function getDryWorkerLoopStatus() {
  return {
    configured: process.env.DRY_WORKER_ENABLED !== "false",
    intervalMs: DRY_WORKER_INTERVAL_MS,
    leaseTimeoutMs: DRY_WORKER_LEASE_TIMEOUT_MS,
    lastTickAt: lastDryWorkerTick?.ranAt ?? null,
    lastClaimedCommandCount: lastDryWorkerTick?.claimedCommandCount ?? 0,
  };
}

export async function runDryWorkerTick(workerId: string, operations: DryWorkerOperations = workerDb): Promise<DryWorkerTickResult> {
  const recovered = await operations.reclaimExpiredCommandLeases(DRY_WORKER_LEASE_TIMEOUT_MS);
  const enabledOwners = await operations.listEnabledWorkerOwners();
  let claimedCommandCount = 0;

  for (const { ownerId } of enabledOwners) {
    await operations.touchWorkerHeartbeat(ownerId);
    const claimed = await operations.claimNextDryCommand(ownerId, workerId);
    if (claimed) claimedCommandCount += 1;
  }

  const result = {
    claimedCommandCount,
    enabledOwnerCount: enabledOwners.length,
    recoveredLeaseCount: recovered.requeued,
    failedLeaseCount: recovered.failed,
    ranAt: new Date(),
  };
  lastDryWorkerTick = result;
  return result;
}

export function startDryWorker(workerId = `dry-worker-${process.pid}`) {
  if (process.env.DRY_WORKER_ENABLED === "false") {
    console.log("[dry-worker] disabled by configuration");
    return () => undefined;
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runDryWorkerTick(workerId);
      if (result.claimedCommandCount || result.recoveredLeaseCount || result.failedLeaseCount) {
        console.log("[dry-worker] tick", result);
      }
    } catch (error) {
      console.error("[dry-worker] tick failed", error);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), DRY_WORKER_INTERVAL_MS);
  console.log(`[dry-worker] started as ${workerId}`);
  return () => clearInterval(timer);
}
