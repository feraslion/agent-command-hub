import { describe, expect, it } from "vitest";
import { scanProjectArchiveSensitiveData, summarizeSensitiveDataScan } from "../lib/project-sensitive-data-scanner";

function storedZip(entries: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const path = encoder.encode(entry.path);
    const content = encoder.encode(entry.content);
    const local = new Uint8Array(30 + path.length + content.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(26, path.length, true);
    local.set(path, 30);
    local.set(content, 30 + path.length);
    locals.push(local);
    const directory = new Uint8Array(46 + path.length);
    const directoryView = new DataView(directory.buffer);
    directoryView.setUint32(0, 0x02014b50, true);
    directoryView.setUint32(20, content.length, true);
    directoryView.setUint32(24, content.length, true);
    directoryView.setUint16(28, path.length, true);
    directoryView.setUint32(42, localOffset, true);
    directory.set(path, 46);
    central.push(directory);
    localOffset += local.length;
  }
  const directorySize = central.reduce((size, record) => size + record.length, 0);
  const eocd = new Uint8Array(22);
  const end = new DataView(eocd.buffer);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, localOffset, true);
  const archive = new Uint8Array(localOffset + directorySize + eocd.length);
  let cursor = 0;
  for (const record of [...locals, ...central, eocd]) { archive.set(record, cursor); cursor += record.length; }
  return archive;
}

describe("project sensitive data scanner", () => {
  it("blocks actual credentials while never persisting the matched value in the summary", () => {
    const archive = storedZip([{ path: ".env", content: "APP_SECRET_TOKEN=super-secret-value-123\n" }, { path: "src/index.ts", content: "export const ok = true;" }]);
    const scan = scanProjectArchiveSensitiveData(archive);
    expect(scan.status).toBe("blocked");
    expect(scan.findings.some((finding) => finding.category === "قيمة اعتماد معرفة في ملف")).toBe(true);
    expect(summarizeSensitiveDataScan(scan)).not.toContain("super-secret-value-123");
  });

  it("blocks private keys and classifies a sensitive filename without a value as review-required", () => {
    const privateKey = scanProjectArchiveSensitiveData(storedZip([{ path: "keys/id_rsa", content: "-----BEGIN RSA PRIVATE KEY-----\nnot-a-real-key\n" }]));
    expect(privateKey.status).toBe("blocked");
    expect(privateKey.findings.some((finding) => finding.severity === "critical")).toBe(true);
    const placeholder = scanProjectArchiveSensitiveData(storedZip([{ path: ".env.example", content: "API_KEY=${API_KEY}\n" }]));
    expect(placeholder.status).toBe("review_required");
    expect(placeholder.findings).toHaveLength(1);
  });

  it("marks ordinary code as clean and reports only file metadata", () => {
    const scan = scanProjectArchiveSensitiveData(storedZip([{ path: "package.json", content: "{\"name\":\"sample\"}" }, { path: "src/main.ts", content: "export function greet() { return 'hello'; }" }]));
    expect(scan).toMatchObject({ status: "clean", scannedFiles: 2, skippedFiles: 0, findings: [] });
  });
});
