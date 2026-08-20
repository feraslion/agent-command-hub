const dockerDocs = {
  mac: "https://docs.docker.com/desktop/setup/install/mac-install/",
  windows: "https://docs.docker.com/desktop/setup/install/windows-install/",
  linux: "https://docs.docker.com/engine/install/",
};

function linuxRecovery(linuxId) {
  switch (linuxId) {
    case "ubuntu":
    case "debian":
      return "Install (Debian/Ubuntu): sudo apt-get update && sudo apt-get install -y docker.io. Then start it: sudo systemctl enable --now docker. Official guide: https://docs.docker.com/engine/install/ubuntu/";
    case "fedora":
      return "Install (Fedora): sudo dnf install -y docker. Then start it: sudo systemctl enable --now docker. Official guide: https://docs.docker.com/engine/install/fedora/";
    case "rhel":
    case "centos":
      return "Install Docker Engine using the RHEL guide, then start it with: sudo systemctl enable --now docker. Official guide: https://docs.docker.com/engine/install/rhel/";
    case "arch":
    case "manjaro":
      return "Install (Arch Linux): sudo pacman -S --needed docker. Then start it: sudo systemctl enable --now docker. Official guide: https://docs.docker.com/engine/install/";
    default:
      return `Install and start Docker Engine for your Linux distribution. Official guide: ${dockerDocs.linux}`;
  }
}

export function dockerRecoveryGuide({ platform = process.platform, linuxId = "" } = {}) {
  switch (platform) {
    case "darwin":
      return "Install Docker Desktop for macOS: brew install --cask docker, then open -a Docker. Official guide: https://docs.docker.com/desktop/setup/install/mac-install/";
    case "win32":
      return "Install Docker Desktop in an Administrator PowerShell: winget install -e --id Docker.DockerDesktop. Start Docker Desktop after installation. Official guide: https://docs.docker.com/desktop/setup/install/windows-install/";
    case "linux":
      return linuxRecovery(linuxId);
    default:
      return `Install Docker Desktop or Docker Engine for your operating system. Official guide: ${dockerDocs.linux}`;
  }
}
