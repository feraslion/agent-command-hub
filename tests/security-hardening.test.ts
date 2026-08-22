import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("audit hardening", () => {
  it("ships real PNG files instead of external symbolic links", () => {
    for (const name of ["icon.png", "favicon.png", "splash-icon.png", "android-icon-foreground.png"]) {
      const file = path.join(projectRoot, "assets", "images", name);
      expect(lstatSync(file).isSymbolicLink()).toBe(false);
      expect(readFileSync(file).subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
  });

  it("does not log token, authorization-code, state, or Set-Cookie fragments", () => {
    const sources = [
      readFileSync(path.join(projectRoot, "lib", "_core", "auth.ts"), "utf8"),
      readFileSync(path.join(projectRoot, "lib", "_core", "api.ts"), "utf8"),
      readFileSync(path.join(projectRoot, "app", "oauth", "callback.tsx"), "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(/token\.substring|sessionToken\.substring|code\.substring|state\.substring/);
    expect(sources).not.toContain("Set-Cookie header received");
    expect(sources).not.toContain("Full URL:");
  });
});
