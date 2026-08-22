import { describe, expect, it, vi } from "vitest";
import { repositoryPublicApiUrl, verifyPublicRepository } from "../lib/repository-existence-check";
import { validateRepositoryReference } from "../lib/project-intake-policy";

describe("repository existence check", () => {
  it("uses provider-owned public API endpoints only", () => {
    expect(repositoryPublicApiUrl(validateRepositoryReference({ remoteUrl: "https://github.com/octo/hub", defaultBranch: "main" }))).toBe("https://api.github.com/repos/octo/hub");
    expect(repositoryPublicApiUrl(validateRepositoryReference({ remoteUrl: "https://gitlab.com/group/mobile/hub", defaultBranch: "main" }))).toBe("https://gitlab.com/api/v4/projects/group%2Fmobile%2Fhub");
    expect(repositoryPublicApiUrl(validateRepositoryReference({ remoteUrl: "https://bitbucket.org/team/hub", defaultBranch: "main" }))).toBe("https://api.bitbucket.org/2.0/repositories/team/hub");
  });

  it("maps public responses without reading repository content", async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => new Response("{}", { status: 200 }));
    const result = await verifyPublicRepository({ remoteUrl: "https://github.com/octo/hub", defaultBranch: "main" }, fetcher);
    expect(result.status).toBe("found");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.github.com/repos/octo/hub");
  });

  it("does not call the network for malformed or credential-bearing input", async () => {
    const fetcher = vi.fn();
    await expect(verifyPublicRepository({ remoteUrl: "https://token@github.com/octo/hub", defaultBranch: "main" }, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
