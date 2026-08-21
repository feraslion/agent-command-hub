import { describe, expect, it } from "vitest";

import { getRunnerConnectionPresentation } from "../lib/runner-connection-presentation";

describe("Runner connection presentation", () => {
  it("does not imply a connection before a device is paired", () => {
    expect(getRunnerConnectionPresentation(null)).toMatchObject({
      title: "Runner غير مربوط",
      tone: "neutral",
      heartbeatLabel: "لا يوجد جهاز مسجل",
    });
  });

  it("shows an actionable ready connection from the live Runner status", () => {
    expect(getRunnerConnectionPresentation({
      status: "ready",
      label: "جهاز التطوير",
      lastHeartbeatAt: "2026-08-21T09:30:00.000Z",
    })).toMatchObject({
      title: "Runner متصل",
      detail: "جهاز التطوير جاهز لاستقبال طلب معتمد.",
      tone: "ready",
    });
  });

  it("keeps pairing and offline states distinct", () => {
    expect(getRunnerConnectionPresentation({ status: "pairing", label: "جهاز العمل" })).toMatchObject({ title: "Runner بانتظار الإقران", tone: "pending" });
    expect(getRunnerConnectionPresentation({ status: "offline", label: "جهاز العمل" })).toMatchObject({ title: "Runner غير متصل", tone: "offline" });
  });
});
