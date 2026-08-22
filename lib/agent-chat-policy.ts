import { redactAgentPromptText } from "./agent-model-policy";

export function sanitizeAgentChatText(value: string) {
  return redactAgentPromptText(value, 2_000);
}

export function buildAgentChatMessages(message: string) {
  const safeMessage = sanitizeAgentChatText(message);
  if (!safeMessage) throw new Error("رسالة الدردشة فارغة.");
  return [
    {
      role: "system" as const,
      content: "أنت مساعد Agent Command Hub. أجب بالعربية بإيجاز وبنبرة عملية. ساعد في التخطيط والمراجعة وفهم الحالة، لكن لا تدّع تنفيذ أوامر أو تشغيل أدوات أو بناء أو دمج أو إرسال شيء. عند طلب فعل مؤثر، اشرح أن التطبيق سيعرضه للموافقة أولاً. لا تكشف أسراراً أو بيانات اعتماد.",
    },
    { role: "user" as const, content: safeMessage },
  ];
}

export function normalizeAgentChatReply(value: unknown) {
  const text = typeof value === "string" ? redactAgentPromptText(value, 4_000) : "";
  if (!text) throw new Error("لم يُرجع المساعد نصاً قابلاً للعرض.");
  return text;
}
