export type ResearchSourceType = "official_docs" | "github_metadata" | "web" | "repository_scan" | "project_memory";
export type ResearchTrustTier = "primary" | "project" | "secondary" | "untrusted";
export type EngineConnectionKind = "internal_planner" | "local_runner" | "github_pr" | "openhands" | "mcp";

const hostileInstructionPattern = /(?:ignore\s+(?:all\s+)?previous|system\s+prompt|developer\s+message|\bsudo\b|\brm\s+-rf\b|curl\s+[^\n]+\|\s*(?:sh|bash)|ignore\s+.*(?:تعليمات|إرشادات)|تجاهل\s+(?:كل\s+)?(?:التعليمات|الإرشادات))/i;

export function trustTierForSourceType(sourceType: ResearchSourceType): ResearchTrustTier {
  if (sourceType === "official_docs") return "primary";
  if (sourceType === "repository_scan" || sourceType === "project_memory") return "project";
  if (sourceType === "github_metadata") return "secondary";
  return "untrusted";
}

export function evidenceInstructionRisk(value: string) {
  return hostileInstructionPattern.test(value) ? 1 : 0;
}

export function defaultEngineCapabilities(kind: EngineConnectionKind) {
  const capabilities = {
    research: false,
    workspace: "none" as "none" | "read" | "sandboxed_write",
    git: "none" as "none" | "pr_only",
    testing: "none" as "none" | "sandboxed",
    streaming: false,
    executionEnabled: false,
  };
  if (kind === "internal_planner") return { ...capabilities, research: true };
  if (kind === "local_runner") return { ...capabilities, workspace: "read" as const, testing: "sandboxed" as const };
  if (kind === "github_pr") return { ...capabilities, research: true, git: "pr_only" as const };
  if (kind === "openhands") return { ...capabilities, research: true, workspace: "sandboxed_write" as const, testing: "sandboxed" as const };
  return { ...capabilities, workspace: "read" as const };
}

export function assertEnginePlanningOnly(input: { kind: EngineConnectionKind; status: "disabled" | "planning" | "approved"; executionRequested: boolean }) {
  if (!input.executionRequested) return;
  if (input.kind !== "internal_planner" || input.status !== "approved") {
    throw new Error("External engine execution is disabled until explicit approval and connector setup");
  }
  throw new Error("Engine execution is not implemented in this release; planning artifacts only");
}
