import { describe, expect, it } from "vitest";

import { buildAgentRunOwnerAlert } from "../lib/agent-run-alert";

describe("agent run owner alert", () => {
  it("summarizes a completed run without leaking secrets", () => {
    const alert = buildAgentRunOwnerAlert({ role: "qa", status: "completed", summary: "PASS with token=private-value", artifactCreated: true });
    expect(alert.title).toContain("ضمان الجودة");
    expect(alert.content).toContain("حُفظ ملف دليل منقح");
    expect(alert.content).not.toContain("private-value");
  });

  it("makes failures explicit without suggesting execution", () => {
    const alert = buildAgentRunOwnerAlert({ role: "coder", status: "failed", summary: "api_key: hidden" });
    expect(alert.title).toContain("فشل");
    expect(alert.content).toContain("لم يُطبق أي تغيير");
    expect(alert.content).not.toContain("hidden");
  });
});
