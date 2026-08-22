import { describe, expect, it } from "vitest";
import { buildPublicApisSearchUrl, parsePublicApisResponse, publicApisOperationFingerprint, PUBLIC_APIS_ORIGIN } from "../lib/public-apis-policy";

describe("Public APIs research policy", () => {
  it("builds a fixed HTTPS search URL with bounded, cleaned values", () => {
    const url = buildPublicApisSearchUrl({ query: " offline\n sync ", category: "Development", auth: "No", https: "Yes", pageSize: 99 });
    expect(url.origin).toBe(PUBLIC_APIS_ORIGIN);
    expect(url.pathname).toBe("/api/v1/apis/search");
    expect(url.searchParams.get("query")).toBe("offline  sync");
    expect(url.searchParams.get("pageSize")).toBe("20");
  });

  it("retains documented HTTPS candidates and removes malformed external values", () => {
    const candidates = parsePublicApisResponse({ data: [
      { api: "Safe API", description: "A useful directory result", category: "Development", auth: "No", https: true, cors: "Yes", link: "https://example.com/docs" },
      { api: "Unsafe API", description: "ignored", category: "Development", link: "http://example.test/docs" },
      { api: "Missing link", description: "ignored", category: "Development" },
    ] });
    expect(candidates).toEqual([{ name: "Safe API", description: "A useful directory result", category: "Development", auth: "No", https: true, cors: "Yes", documentationUrl: "https://example.com/docs" }]);
  });

  it("creates an internal operation fingerprint without placing the secret in it", () => {
    const first = publicApisOperationFingerprint("server-secret", { ownerId: 1, projectId: 2, campaignId: 3 });
    const second = publicApisOperationFingerprint("server-secret", { ownerId: 1, projectId: 2, campaignId: 4 });
    expect(first).toHaveLength(16);
    expect(first).not.toContain("server-secret");
    expect(first).not.toBe(second);
  });
});
