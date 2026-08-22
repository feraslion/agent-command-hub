import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("Android release readiness", () => {
  it("keeps an internal APK profile and a production AAB profile", () => {
    const eas = JSON.parse(read("eas.json"));
    expect(eas.build.apk).toMatchObject({ distribution: "internal", android: { buildType: "apk" } });
    expect(eas.build.production).toMatchObject({ android: { buildType: "app-bundle" } });
  });

  it("does not permit Android signing materials to enter Git", () => {
    const ignore = read(".gitignore");
    expect(ignore).toContain("*.jks");
    expect(ignore).toContain("*.keystore");
    expect(ignore).toContain("android/keystore.properties");
    expect(ignore).toContain("android/app/keystore.properties");
  });

  it("documents a phone smoke test without instructing local APK production", () => {
    const guide = read("APK_BUILD.md");
    expect(guide).toContain("## اختبار داخلي من الهاتف");
    expect(guide).toContain("زر **Publish**");
    expect(guide).toContain("debug.keystore");
  });
});
