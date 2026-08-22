import { describe, expect, it } from "vitest";

import { getExternalAutomationReadiness } from "../lib/external-automation-policy";

describe("external automation policy", () => {
  it("keeps every external route disabled until its explicit prerequisites exist", () => {
    for (const kind of ["manus_task", "connector", "scheduled_digest", "persistent_runner"] as const) {
      const state = getExternalAutomationReadiness(kind);
      expect(state.enabled).toBe(false);
      expect(state.required).toContain("موافقة صريحة من المالك");
    }
  });

  it("distinguishes the Docker proof needed by a persistent runner", () => {
    const state = getExternalAutomationReadiness("persistent_runner");
    expect(state.reason).toContain("Docker");
    expect(state.required).toContain("Smoke Test للحاوية المقيدة");
  });
});
