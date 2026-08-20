import { describe, expect, it } from "vitest";
import { assertLocalRunnerExecutable, LocalRunnerPolicyError, localRunnerPolicy, truncateRunnerOutput } from "../server/local-runner-policy";

describe("local runner policy", () => {
  it("accepts a standalone JavaScript file inside the allowed Workspace scope", () => {
    expect(assertLocalRunnerExecutable("source/math.js", "console.log(2 + 2);")).toEqual({ normalizedPath: "source/math.js", profile: "node_script" });
  });

  it("rejects files outside the execution scope and blocked capabilities", () => {
    expect(() => assertLocalRunnerExecutable("docs/readme.js", "console.log('no');")).toThrow(LocalRunnerPolicyError);
    expect(() => assertLocalRunnerExecutable("source/network.js", "fetch('https://example.com');")).toThrow(LocalRunnerPolicyError);
    expect(() => assertLocalRunnerExecutable("source/runtime.ts", "console.log('no');")).toThrow(LocalRunnerPolicyError);
  });

  it("caps persisted output deterministically", () => {
    const value = "x".repeat(localRunnerPolicy.stdoutLimit + 20);
    const truncated = truncateRunnerOutput(value, localRunnerPolicy.stdoutLimit);
    expect(truncated).toContain("تم اقتطاع المخرجات");
    expect(truncated.length).toBeGreaterThan(localRunnerPolicy.stdoutLimit);
  });
});
