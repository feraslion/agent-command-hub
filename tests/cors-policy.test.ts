import { describe, expect, it } from "vitest";

import { getAllowedCorsOrigins, isAllowedCorsOrigin } from "../server/_core/cors";

describe("credentialed CORS policy", () => {
  it("allows only the published application and explicitly configured preview origins", () => {
    const environment = {
      EXPO_PACKAGER_PROXY_URL: "https://8081-preview.manus.computer/path",
      CORS_ALLOWED_ORIGINS: "https://console.example.com,not a url",
    };
    expect(getAllowedCorsOrigins(environment)).toEqual(expect.objectContaining(new Set([
      "https://agenthub-gkta8g2i.manus.space",
      "https://8081-preview.manus.computer",
      "https://console.example.com",
    ])));
    expect(isAllowedCorsOrigin("https://8081-preview.manus.computer", environment)).toBe(true);
  });

  it("does not reflect an arbitrary attacker origin", () => {
    expect(isAllowedCorsOrigin("https://attacker.example", { EXPO_PACKAGER_PROXY_URL: "https://8081-preview.manus.computer" })).toBe(false);
    expect(isAllowedCorsOrigin("null", {})).toBe(false);
  });
});
