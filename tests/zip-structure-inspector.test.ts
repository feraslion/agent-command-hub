import { describe, expect, it } from "vitest";
import { getBuildTemplate } from "../lib/build-template-registry";
import { inspectZipStructure } from "../lib/zip-structure-inspector";

function listedZip(names: string[]) {
  const encoder = new TextEncoder();
  const records = names.map((name) => {
    const encoded = encoder.encode(name);
    const record = new Uint8Array(46 + encoded.length);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(28, encoded.length, true);
    record.set(encoded, 46);
    return record;
  });
  const directorySize = records.reduce((total, record) => total + record.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, names.length, true);
  endView.setUint16(10, names.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, 0, true);
  const zip = new Uint8Array(directorySize + end.length);
  let offset = 0;
  for (const record of records) {
    zip.set(record, offset);
    offset += record.length;
  }
  zip.set(end, offset);
  return zip;
}

describe("ZIP structure inspector", () => {
  it("reads only central-directory names and suggests Expo, Node and Docker templates", () => {
    const inspection = inspectZipStructure(listedZip(["app.config.ts", "package.json", "pnpm-lock.yaml", "src/index.ts", "src/index.test.ts", "Dockerfile", "assets/"]));
    expect(inspection).toMatchObject({ fileCount: 6, directoryCount: 1, languages: ["TypeScript"], packageManagers: ["pnpm"] });
    expect(inspection.suggestedTemplateKeys).toEqual(["expo-mobile", "node-service", "docker-image"]);
    expect(inspection.testSignals).toContain("src/index.test.ts");
  });

  it("rejects missing or malformed central directories before any extraction", () => {
    expect(() => inspectZipStructure(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toThrow("فهرس ZIP");
    const malformed = listedZip(["package.json"]);
    new DataView(malformed.buffer).setUint32(0, 0x11111111, true);
    expect(() => inspectZipStructure(malformed)).toThrow("فهرس ZIP");
  });

  it("keeps the template registry explicit and target-compatible", () => {
    expect(getBuildTemplate("expo-mobile").targets).toContain("android");
    expect(getBuildTemplate("docker-image").targets).toContain("docker");
    expect(() => getBuildTemplate("arbitrary-shell")).toThrow("غير مدعوم");
  });
});
