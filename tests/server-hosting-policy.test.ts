import { describe, expect, it } from "vitest";

import { validateHostingTarget } from "../lib/server-hosting-policy";

describe("server hosting policy", () => {
  it("accepts a manual Render API target without storing any credential", () => {
    expect(validateHostingTarget({ provider: "render", kind: "api", label: "خادم الإنتاج", endpoint: "https://agenthub.onrender.com" })).toEqual({ label: "خادم الإنتاج", endpoint: "https://agenthub.onrender.com/", repositoryUrl: null, notes: null, status: "ready" });
  });

  it("rejects credentials embedded inside an endpoint URL", () => {
    expect(() => validateHostingTarget({ provider: "render", kind: "api", label: "خادم", endpoint: "https://token@example.com" })).toThrow("بيانات اعتماد");
  });

  it("rejects providers that do not support the selected target kind", () => {
    expect(() => validateHostingTarget({ provider: "tidb_cloud", kind: "api", label: "قاعدة" })).toThrow("غير متاح");
  });
});
