import { describe, expect, it } from "vitest";

import { getRunnerReadiness } from "../lib/runner-readiness";

describe("runner readiness presentation", () => {
  it("shows only capabilities declared by a connected runner heartbeat", () => {
    expect(getRunnerReadiness({
      status: "ready",
      capabilities: JSON.stringify({ docker: true, profiles: ["node_script", "typescript_lockfile"] }),
    })).toEqual({
      connectionLabel: "متصل وجاهز",
      canAcceptWork: true,
      dockerLabel: "أبلغ Runner بأنه جاهز",
      javascriptLabel: "مدعوم",
      typescriptLabel: "مدعوم",
    });
  });

  it("does not present stale or malformed capabilities as proof of readiness", () => {
    expect(getRunnerReadiness({ status: "offline", capabilities: "not-json" })).toEqual({
      connectionLabel: "غير متصل",
      canAcceptWork: false,
      dockerLabel: "لم يصل إثبات جاهزية",
      javascriptLabel: "غير متاح",
      typescriptLabel: "غير متاح",
    });
  });
});
