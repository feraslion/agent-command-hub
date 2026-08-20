import { describe, expect, it } from "vitest";
import { dockerRecoveryGuide } from "../runner/docker-support.mjs";

describe("Docker recovery guidance", () => {
  it("gives Docker Desktop installation guidance for macOS", () => {
    const guide = dockerRecoveryGuide({ platform: "darwin" });
    expect(guide).toContain("brew install --cask docker");
    expect(guide).toContain("https://docs.docker.com/desktop/setup/install/mac-install/");
  });

  it("gives Docker Desktop installation guidance for Windows", () => {
    const guide = dockerRecoveryGuide({ platform: "win32" });
    expect(guide).toContain("winget install -e --id Docker.DockerDesktop");
    expect(guide).toContain("https://docs.docker.com/desktop/setup/install/windows-install/");
  });

  it("selects package-manager guidance for supported Linux distributions", () => {
    expect(dockerRecoveryGuide({ platform: "linux", linuxId: "ubuntu" })).toContain("sudo apt-get install -y docker.io");
    expect(dockerRecoveryGuide({ platform: "linux", linuxId: "fedora" })).toContain("sudo dnf install -y docker");
    expect(dockerRecoveryGuide({ platform: "linux", linuxId: "arch" })).toContain("sudo pacman -S --needed docker");
  });

  it("falls back to the official Linux installation guide for unknown systems", () => {
    expect(dockerRecoveryGuide({ platform: "linux", linuxId: "unknown" })).toContain("https://docs.docker.com/engine/install/");
  });
});
