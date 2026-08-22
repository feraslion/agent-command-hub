import { describe, expect, it } from "vitest";

import { buildAgentOutputArtifact } from "../lib/agent-output-artifact";

describe("agent output artifact", () => {
  it("stores a structured output document with sensitive values redacted", () => {
    const artifact = buildAgentOutputArtifact({
      projectId: 8,
      runId: 14,
      role: "coder",
      model: "gpt-5",
      summary: "تمت مراجعة token=live-secret",
      output: { summary: "اقترح diff فقط؛ api_key: ABC123", proposedDiff: "const x = 1", assumptions: [], risks: [] },
    });
    const content = JSON.parse(artifact.content);
    expect(artifact.storagePath).toBe("agent-outputs/8/14-coder.json");
    expect(artifact.kind).toBe("agent_model_output");
    expect(content.summary).not.toContain("live-secret");
    expect(content.output.summary).not.toContain("ABC123");
    expect(content.output.proposedDiff).toBe("const x = 1");
  });

  it("keeps the artifact bounded when an output contains many items", () => {
    const artifact = buildAgentOutputArtifact({ projectId: 2, runId: 3, role: "qa", model: "gpt-5-mini", summary: "ملخص", output: { evidence: Array.from({ length: 50 }, (_, index) => `دليل ${index}`) } });
    expect(JSON.parse(artifact.content).output.evidence).toHaveLength(24);
  });
});
