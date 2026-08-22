import { describe, expect, it, vi } from "vitest";

import { assertManualHostingCheckEndpoint, formatHostingCheckResult } from "../lib/server-hosting-policy";
import { runManualHostingCheck } from "../server/hosting-connectivity-service";

describe("hosting connectivity policy", () => {
  it("permits only the public provider subdomain belonging to the selected provider", () => {
    expect(assertManualHostingCheckEndpoint({ provider: "render", endpoint: "https://agenthub.onrender.com/health" })).toBe("https://agenthub.onrender.com/health");
    expect(() => assertManualHostingCheckEndpoint({ provider: "render", endpoint: "https://127.0.0.1:3000" })).toThrow("غير مسموح");
    expect(() => assertManualHostingCheckEndpoint({ provider: "render", endpoint: "https://not-onrender.com" })).toThrow("غير مسموح");
  });

  it("returns a redacted reachable result without reading the response body", async () => {
    const cancel = vi.fn();
    const fetchImplementation = vi.fn().mockResolvedValue({ status: 204, body: { cancel } });
    const result = await runManualHostingCheck({ provider: "render", endpoint: "https://agenthub.onrender.com/health" }, { fetchImplementation, now: () => 100 });
    expect(result).toEqual({ checkStatus: "reachable", statusCode: 204, summary: "استجاب الخادم بنجاح عبر HTTPS (HTTP 204).", durationMs: 0 });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("normalizes failures without exposing raw network errors", () => {
    expect(formatHostingCheckResult({ status: 503 })).toEqual({ checkStatus: "unreachable", statusCode: 503, summary: "استجاب العنوان، لكنه أعاد HTTP 503 ولا يعد جاهزاً." });
  });
});
