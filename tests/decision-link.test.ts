import { describe, expect, it } from "vitest";
import { approvalDecisionPath } from "../lib/decision-link";

describe("approval decision links", () => {
  it("creates a stable in-app route for a decision", () => {
    expect(approvalDecisionPath(42)).toBe("/approval/42");
  });

  it("rejects malformed identifiers", () => {
    expect(() => approvalDecisionPath("42/../settings")).toThrow();
  });
});
