export type RunnerReadinessInput = {
  status?: string | null;
  capabilities?: string | null;
};

export type RunnerReadiness = {
  connectionLabel: string;
  canAcceptWork: boolean;
  dockerLabel: string;
  javascriptLabel: string;
  typescriptLabel: string;
};

type RunnerCapabilities = {
  docker?: boolean;
  profiles?: unknown;
};

function parseCapabilities(value: string | null | undefined): RunnerCapabilities {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as RunnerCapabilities;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * يحول آخر heartbeat مسجل إلى عرض صادق: القدرة لا تعد جاهزة إلا عندما
 * يصرح العميل بها ويكون Runner في الحالة المتصلة المناسبة.
 */
export function getRunnerReadiness(input: RunnerReadinessInput): RunnerReadiness {
  const capabilities = parseCapabilities(input.capabilities);
  const profiles = Array.isArray(capabilities.profiles)
    ? capabilities.profiles.filter((profile): profile is string => typeof profile === "string")
    : [];
  const connected = input.status === "ready" || input.status === "busy";
  const canAcceptWork = input.status === "ready";
  const connectionLabel = input.status === "ready"
    ? "متصل وجاهز"
    : input.status === "busy"
      ? "متصل وينفذ طلباً"
      : input.status === "pairing"
        ? "بانتظار الإقران"
        : input.status === "revoked"
          ? "ملغى"
          : "غير متصل";

  return {
    connectionLabel,
    canAcceptWork,
    dockerLabel: connected && capabilities.docker === true ? "أبلغ Runner بأنه جاهز" : "لم يصل إثبات جاهزية",
    javascriptLabel: connected && profiles.includes("node_script") ? "مدعوم" : "غير متاح",
    typescriptLabel: connected && profiles.includes("typescript_lockfile") ? "مدعوم" : "غير متاح",
  };
}
