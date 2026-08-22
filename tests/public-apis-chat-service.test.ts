import { describe, expect, it, vi } from "vitest";

import { searchPublicApisForChat } from "../server/public-apis-chat-service";

describe("Public APIs chat service", () => {
  it("returns a bounded, read-only context from HTTPS catalog entries", async () => {
    const fetchOperation = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ api: "Example API", description: "Documentation only", category: "Development", auth: "No", https: true, cors: true, link: "https://example.com/docs" }, { api: "Unsafe", description: "skip", link: "http://example.com" }] }), { status: 200 }));
    const result = await searchPublicApisForChat("ابحث عن API للتطوير", fetchOperation as never);
    expect(result.count).toBe(1);
    expect(result.context).toContain("Example API");
    expect(result.context).not.toContain("Unsafe");
    expect(fetchOperation.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });

  it("does not turn a catalog rate limit into an invented search result", async () => {
    await expect(searchPublicApisForChat("API", vi.fn().mockResolvedValue(new Response("", { status: 429 })) as never)).rejects.toThrow("حدّ دليل Public APIs");
  });
});
