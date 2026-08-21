import { describe, expect, it } from "vitest";
import { previewRepositoryUrl } from "../lib/repository-url-preview";

describe("repository URL preview", () => {
  it("extracts GitHub repository identity without a network request", () => {
    expect(previewRepositoryUrl("https://github.com/feraslion/agent-command-hub.git")).toEqual({
      state: "ready",
      preview: {
        provider: "github",
        iconName: "github",
        platformLabel: "GitHub",
        repositoryName: "agent-command-hub",
        namespace: "feraslion",
        normalizedUrl: "https://github.com/feraslion/agent-command-hub",
      },
    });
  });

  it("supports nested GitLab namespaces", () => {
    expect(previewRepositoryUrl("https://gitlab.com/group/mobile/hub")).toMatchObject({
      state: "ready",
      preview: { provider: "gitlab", repositoryName: "hub", namespace: "group/mobile" },
    });
  });

  it("rejects credentials, SSH-like text, and unsupported hosts", () => {
    expect(previewRepositoryUrl("https://token@gitlab.com/group/hub")).toMatchObject({ state: "invalid" });
    expect(previewRepositoryUrl("git@github.com:owner/repo.git")).toMatchObject({ state: "invalid" });
    expect(previewRepositoryUrl("https://bitbucket.org/owner/repo")).toMatchObject({ state: "invalid" });
  });
});
