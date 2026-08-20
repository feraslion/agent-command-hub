import { describe, expect, it } from "vitest";
import { hasValidManualMultiFileBundle, isEligibleMultiFilePath, MAX_MANUAL_MULTI_FILE_SELECTION, toggleMultiFileSelection } from "../lib/multi-file-bundle-selection";

describe("manual multi-file bundle selection", () => {
  it("accepts only TypeScript files inside source or tests", () => {
    expect(isEligibleMultiFilePath("source/main.ts")).toBe(true);
    expect(isEligibleMultiFilePath("tests/math.mts")).toBe(true);
    expect(isEligibleMultiFilePath("docs/readme.ts")).toBe(false);
    expect(isEligibleMultiFilePath("source/main.js")).toBe(false);
  });

  it("toggles eligible files and preserves the selection limit", () => {
    expect(toggleMultiFileSelection(["source/main.ts"], "source/math.ts")).toEqual(["source/main.ts", "source/math.ts"]);
    expect(toggleMultiFileSelection(["source/main.ts"], "source/main.ts")).toEqual([]);
    expect(toggleMultiFileSelection([], "docs/readme.ts")).toEqual([]);
    expect(toggleMultiFileSelection(Array.from({ length: MAX_MANUAL_MULTI_FILE_SELECTION }, (_, index) => `source/file-${index}.ts`), "source/overflow.ts")).toHaveLength(MAX_MANUAL_MULTI_FILE_SELECTION);
  });

  it("requires the visible entry file to be included in a two-file bundle", () => {
    expect(hasValidManualMultiFileBundle("source/main.ts", ["source/main.ts", "source/math.ts"])).toBe(true);
    expect(hasValidManualMultiFileBundle("source/main.ts", ["source/math.ts", "source/format.ts"])).toBe(false);
    expect(hasValidManualMultiFileBundle("source/main.ts", ["source/main.ts"])).toBe(false);
  });
});
