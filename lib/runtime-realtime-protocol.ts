export type RuntimeRealtimeMessage = {
  type?: string;
  resources?: string[];
};

export type RuntimeConnectionState = "connecting" | "live" | "fallback";

export function getRuntimeConnectionPresentation(state: RuntimeConnectionState) {
  if (state === "live") {
    return { tone: "live" as const, label: "متصل · تحديث لحظي", detail: "تصل تغييرات السجل والموافقات فور حدوثها." };
  }
  if (state === "connecting") {
    return { tone: "reconnecting" as const, label: "منقطع مؤقتاً · جارٍ إعادة الاتصال", detail: "سيُستأنف التحديث اللحظي تلقائياً عند نجاح الاتصال." };
  }
  return { tone: "polling" as const, label: "يعتمد على الاستعلام التلقائي", detail: "تُراجع البيانات كل 8 ثوانٍ إلى أن تعود القناة اللحظية." };
}

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
