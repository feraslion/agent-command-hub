export type RunnerConnectionInput = {
  status?: string | null;
  label?: string | null;
  lastHeartbeatAt?: Date | string | null;
};

export type RunnerConnectionPresentation = {
  title: string;
  detail: string;
  heartbeatLabel: string;
  tone: "ready" | "working" | "pending" | "offline" | "neutral";
};

function formatHeartbeat(value: Date | string | null | undefined) {
  if (!value) return "لم تصل نبضة بعد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "وقت النبضة غير متاح";
  return `آخر نبضة ${date.toLocaleString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * عرض موجز وصادق لحالة الجهاز، منفصل عن تفاصيل القدرات والتنفيذ الموجودة
 * في شاشة الإعدادات. لا يعامل الإقران وحده كاتصال صالح.
 */
export function getRunnerConnectionPresentation(runner: RunnerConnectionInput | null | undefined): RunnerConnectionPresentation {
  if (!runner) {
    return {
      title: "Runner غير مربوط",
      detail: "جهّز الإقران من الإعدادات عند توفر جهاز Docker.",
      heartbeatLabel: "لا يوجد جهاز مسجل",
      tone: "neutral",
    };
  }

  const deviceLabel = runner.label?.trim() || "الجهاز المحلي";
  const heartbeatLabel = formatHeartbeat(runner.lastHeartbeatAt);
  if (runner.status === "ready") {
    return { title: "Runner متصل", detail: `${deviceLabel} جاهز لاستقبال طلب معتمد.`, heartbeatLabel, tone: "ready" };
  }
  if (runner.status === "busy") {
    return { title: "Runner متصل", detail: `${deviceLabel} ينفذ طلباً معتمداً حالياً.`, heartbeatLabel, tone: "working" };
  }
  if (runner.status === "pairing") {
    return { title: "Runner بانتظار الإقران", detail: `${deviceLabel} مسجل؛ شغّل العميل المحلي لإرسال النبضة.`, heartbeatLabel, tone: "pending" };
  }
  if (runner.status === "revoked") {
    return { title: "Runner غير متصل", detail: `أُلغي إقران ${deviceLabel}. أنشئ إقراناً جديداً عند الحاجة.`, heartbeatLabel, tone: "offline" };
  }
  return { title: "Runner غير متصل", detail: `${deviceLabel} لا يملك نبضة صالحة حالياً.`, heartbeatLabel, tone: "offline" };
}
