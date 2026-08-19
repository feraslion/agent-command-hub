import { describe, expect, it, vi } from "vitest";
import { runDryWorkerTick } from "../server/dry-worker";

describe("حلقة العامل الجاف", () => {
  it("تجدد heartbeat وتحجز أمراً واحداً كحد أقصى لكل مالك مفعّل", async () => {
    const operations = {
      reclaimExpiredCommandLeases: vi.fn().mockResolvedValue({ requeued: 2, failed: 1 }),
      listEnabledWorkerOwners: vi.fn().mockResolvedValue([{ ownerId: 11 }, { ownerId: 22 }]),
      touchWorkerHeartbeat: vi.fn().mockResolvedValue(undefined),
      claimNextDryCommand: vi.fn().mockResolvedValueOnce({ id: 101 }).mockResolvedValueOnce(undefined),
    };
    const runRuntime = vi.fn().mockResolvedValue({ createdPlanCount: 1, observedClaimCount: 1 });

    const result = await runDryWorkerTick("dry-worker-test", operations, runRuntime);

    expect(operations.reclaimExpiredCommandLeases).toHaveBeenCalledOnce();
    expect(operations.touchWorkerHeartbeat).toHaveBeenCalledTimes(2);
    expect(operations.claimNextDryCommand).toHaveBeenNthCalledWith(1, 11, "dry-worker-test");
    expect(operations.claimNextDryCommand).toHaveBeenNthCalledWith(2, 22, "dry-worker-test");
    expect(runRuntime).toHaveBeenCalledWith("dry-worker-test", [11, 22]);
    expect(result).toMatchObject({ enabledOwnerCount: 2, claimedCommandCount: 1, recoveredLeaseCount: 2, failedLeaseCount: 1, createdPlanCount: 1 });
  });
});
