export type RuntimeRealtimeMessage = {
  type?: string;
  resources?: string[];
};

export function buildRuntimeWebSocketUrl(apiBaseUrl: string): string | null {
  if (!apiBaseUrl) return null;
  try {
    const url = new URL(apiBaseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/api/runtime-updates";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isRuntimeInvalidation(value: unknown): value is RuntimeRealtimeMessage {
  return Boolean(value && typeof value === "object" && (value as RuntimeRealtimeMessage).type === "runtime.invalidate");
}
