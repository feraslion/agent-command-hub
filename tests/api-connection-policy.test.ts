import { describe, expect, it } from "vitest";

import { apiConnectionCatalog, getApiConnectionRequest } from "../lib/api-connection-policy";

describe("API connection policy", () => {
  it("does not treat OpenRouter as configured without an external secure setup", () => {
    expect(getApiConnectionRequest("openrouter")).toMatchObject({
      provider: "openrouter",
      authMode: "api_key",
      status: "awaiting_setup",
    });
  });

  it("allows the existing public API source without a key", () => {
    expect(getApiConnectionRequest("public_apis")).toMatchObject({
      authMode: "none",
      status: "linked",
    });
  });

  it("documents GitHub as an OAuth connection instead of a pasted token", () => {
    expect(apiConnectionCatalog.github.authMode).toBe("oauth");
    expect(apiConnectionCatalog.github.setupCopy).toContain("لا تضع رمز GitHub");
  });
});
