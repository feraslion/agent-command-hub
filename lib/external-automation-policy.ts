export type ExternalAutomationKind = "manus_task" | "connector" | "scheduled_digest" | "persistent_runner";

export type ExternalAutomationReadiness = {
  kind: ExternalAutomationKind;
  enabled: false;
  reason: string;
  required: string[];
};

export function getExternalAutomationReadiness(kind: ExternalAutomationKind): ExternalAutomationReadiness {
  const common = ["موافقة صريحة من المالك", "سجل تدقيق منقح", "عدم إرسال أسرار أو محتوى Workspace الخام"];
  if (kind === "manus_task") return { kind, enabled: false, reason: "لا يوجد اعتماد Manus API مهيأ في المشروع.", required: [...common, "مفتاح API خادم-فقط أو OAuth معتمد", "مخطط JSON للمخرجات", "سياسة تعامل مع انتظار الموافقة"] };
  if (kind === "connector") return { kind, enabled: false, reason: "لا يوجد موصل خارجي مفعّل لهذه الجلسة.", required: [...common, "موصل محدد من المالك", "توثيق رسمي لنطاقات الصلاحية", "فحص صحة بعد الاعتماد"] };
  if (kind === "scheduled_digest") return { kind, enabled: false, reason: "الملخص اليدوي متاح؛ الجدولة الدورية لم تعتمد بعد.", required: [...common, "نسخة منشورة", "معالج /api/scheduled/ موثق", "تكرار منخفض ومفتاح مهمة محفوظ"] };
  return { kind, enabled: false, reason: "Runner المحلي يحتاج إثبات Docker على جهاز المالك قبل التشغيل المستمر.", required: [...common, "نبضة موثقة", "Smoke Test للحاوية المقيدة", "نتيجة تنفيذ معتمد محفوظة"] };
}
