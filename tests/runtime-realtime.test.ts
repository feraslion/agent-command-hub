import { describe, expect, it } from "vitest";

import { buildRuntimeWebSocketUrl, getRuntimeConnectionPresentation, isRuntimeInvalidation } from "../lib/runtime-realtime-protocol";

describe("runtime realtime helpers", () => {
  it("converts secure and local API origins into a websocket endpoint", () => {
    expect(buildRuntimeWebSocketUrl("https://3000-demo.manus.computer")).toBe("wss://3000-demo.manus.computer/api/runtime-updates");
    expect(buildRuntimeWebSocketUrl("http://127.0.0.1:3000")).toBe("ws://127.0.0.1:3000/api/runtime-updates");
    expect(buildRuntimeWebSocketUrl("")).toBeNull();
  });

  it("accepts only runtime invalidation messages", () => {
    expect(isRuntimeInvalidation({ type: "runtime.invalidate", resources: ["approvals"] })).toBe(true);
    expect(isRuntimeInvalidation({ type: "runtime.ready" })).toBe(false);
    expect(isRuntimeInvalidation(null)).toBe(false);
  });

  it("presents an explicit label for each visible connection state", () => {
    expect(getRuntimeConnectionPresentation("live").label).toContain("متصل");
    expect(getRuntimeConnectionPresentation("connecting").label).toContain("منقطع");
    expect(getRuntimeConnectionPresentation("fallback").label).toContain("الاستعلام التلقائي");
  });
});
