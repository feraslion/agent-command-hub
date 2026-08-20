import { describe, expect, it } from "vitest";
import { assertManagedWorkerOperation, getManagedWorkerBoundary } from "../server/managed-worker-policy";

describe("managed periodic worker policy", () => {
  it("allows dry planning operations only", () => {
    expect(() => assertManagedWorkerOperation("create_dry_plan")).not.toThrow();
    expect(getManagedWorkerBoundary().prohibitedCapabilities).toContain("docker");
  });

  it("rejects privileged or destructive operations", () => {
    expect(() => assertManagedWorkerOperation("deploy")).toThrow("لا يملك صلاحية");
    expect(() => assertManagedWorkerOperation("workspace_write")).toThrow("لا يملك صلاحية");
  });
});
