export const hostingProviderValues = ["render", "tidb_cloud", "railway", "koyeb", "manus_managed"] as const;
export const hostingTargetKindValues = ["api", "database"] as const;

export type HostingProvider = (typeof hostingProviderValues)[number];
export type HostingTargetKind = (typeof hostingTargetKindValues)[number];

export const hostingProviderCatalog: Record<HostingProvider, { label: string; summary: string; supportedKinds: HostingTargetKind[]; manualOnly: boolean }> = {
  render: { label: "Render", summary: "خدمة API مجانية للتجربة مع سكون تلقائي بعد عدم النشاط.", supportedKinds: ["api"], manualOnly: true },
  tidb_cloud: { label: "TiDB Cloud", summary: "قاعدة MySQL/TiDB مُدارة متوافقة مع مخطط المشروع الحالي.", supportedKinds: ["database"], manualOnly: true },
  railway: { label: "Railway", summary: "بديل خفيف لتجربة خدمات API ومشاريع جانبية.", supportedKinds: ["api", "database"], manualOnly: true },
  koyeb: { label: "Koyeb", summary: "استضافة استخدامية لخدمات API قابلة للتوسع.", supportedKinds: ["api"], manualOnly: true },
  manus_managed: { label: "الاستضافة المُدارة", summary: "الخدمة الحالية المُدارة؛ لا تحتاج إلى نقل أو مفتاح خارجي.", supportedKinds: ["api"], manualOnly: true },
};

function safeHttpsUrl(value: string, fieldLabel: string) {
  if (!value.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`${fieldLabel} يجب أن يكون رابط HTTPS صالحاً.`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error(`${fieldLabel} يجب أن يكون HTTPS ومن دون بيانات اعتماد ضمن الرابط.`);
  }
  return parsed.toString();
}

export function validateHostingTarget(input: { provider: HostingProvider; kind: HostingTargetKind; label: string; endpoint?: string | null; repositoryUrl?: string | null; notes?: string | null }) {
  const provider = hostingProviderCatalog[input.provider];
  if (!provider.supportedKinds.includes(input.kind)) throw new Error(`${provider.label} غير متاح لهذا النوع من الخدمة.`);
  const label = input.label.trim();
  if (label.length < 2 || label.length > 128) throw new Error("اسم الخادم يجب أن يتراوح بين حرفين و128 حرفاً.");
  const endpoint = safeHttpsUrl(input.endpoint ?? "", "عنوان الخدمة");
  const repositoryUrl = safeHttpsUrl(input.repositoryUrl ?? "", "رابط المستودع");
  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 2_000) throw new Error("ملاحظات الخادم طويلة جداً.");
  return { label, endpoint, repositoryUrl, notes, status: endpoint ? "ready" as const : "draft" as const };
}
