import { describe, expect, it } from "vitest";
import { assertMultiFileBundle } from "../server/multi-file-runner-policy";

describe("multi-file runner policy", () => {
  const bundle = [
    { path: "source/main.ts", content: 'import { add } from "./math";\nconsole.log(add(2, 3));' },
    { path: "source/math.ts", content: "export const add = (a: number, b: number) => a + b;" },
  ];

  it("accepts bounded local TypeScript imports", () => {
    expect(assertMultiFileBundle("source/main.ts", bundle)).toMatchObject({ entryPath: "source/main.ts", totalBytes: expect.any(Number) });
  });

  it("rejects package imports and system access", () => {
    expect(() => assertMultiFileBundle("source/main.ts", [{ path: "source/main.ts", content: 'import fs from "node:fs";' }, bundle[1]])).toThrow();
    expect(() => assertMultiFileBundle("source/main.ts", [{ path: "source/main.ts", content: "console.log(process.env.SECRET);" }, bundle[1]])).toThrow();
  });

  it("rejects paths outside the approved roots", () => {
    expect(() => assertMultiFileBundle("source/main.ts", [{ path: "source/main.ts", content: "console.log(1);" }, { path: "../secret.ts", content: "export {};" }])).toThrow();
  });
});
