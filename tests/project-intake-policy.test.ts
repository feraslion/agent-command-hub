import { describe, expect, it } from "vitest";
import { MAX_PROJECT_ARCHIVE_BYTES, ProjectIntakePolicyError, validateBuildRequest, validateRepositoryReference, validateZipArchive } from "../lib/project-intake-policy";

const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);

describe("project intake policy", () => {
  it("accepts a bounded ZIP archive without unpacking it", () => {
    expect(validateZipArchive({ fileName: "my project.zip", byteSize: zipBytes.length, bytes: zipBytes })).toMatchObject({ safeName: "my_project.zip", byteSize: zipBytes.length });
  });

  it("rejects malformed, oversized, and non-ZIP archives", () => {
    expect(() => validateZipArchive({ fileName: "source.tar", byteSize: zipBytes.length, bytes: zipBytes })).toThrow(ProjectIntakePolicyError);
    expect(() => validateZipArchive({ fileName: "source.zip", byteSize: MAX_PROJECT_ARCHIVE_BYTES + 1, bytes: new Uint8Array(MAX_PROJECT_ARCHIVE_BYTES + 1) })).toThrow(ProjectIntakePolicyError);
    expect(() => validateZipArchive({ fileName: "source.zip", byteSize: 4, bytes: new Uint8Array([1, 2, 3, 4]) })).toThrow(ProjectIntakePolicyError);
  });

  it("permits only public HTTPS references to approved repository platforms", () => {
    expect(validateRepositoryReference({ remoteUrl: "https://github.com/acme/sample.git", defaultBranch: "main" })).toMatchObject({ provider: "github", repositoryName: "acme/sample" });
    expect(() => validateRepositoryReference({ remoteUrl: "git@github.com:acme/sample.git", defaultBranch: "main" })).toThrow(ProjectIntakePolicyError);
    expect(() => validateRepositoryReference({ remoteUrl: "https://token@example.invalid/acme/sample", defaultBranch: "main" })).toThrow(ProjectIntakePolicyError);
  });

  it("keeps builds as typed planning requests", () => {
    expect(validateBuildRequest({ target: "android", title: "APK تجريبي", summary: "تجهيز طلب بناء محلي بعد إثبات Runner." })).toMatchObject({ target: "android" });
    expect(() => validateBuildRequest({ target: "shell", title: "x", summary: "قصير" })).toThrow(ProjectIntakePolicyError);
  });
});
