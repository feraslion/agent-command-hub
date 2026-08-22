export const hostingProviderValues = ["render", "tidb_cloud", "railway", "koyeb", "manus_managed"] as const;
export const hostingTargetKindValues = ["api", "database"] as const;
export const hostingCheckStatusValues = ["not_tested", "reachable", "unreachable", "blocked"] as const;

export type HostingProvider = (typeof hostingProviderValues)[number];
export type HostingTargetKind = (typeof hostingTargetKindValues)[number];
export type HostingCheckStatus = (typeof hostingCheckStatusValues)[number];

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

const providerEndpointDomains: Record<HostingProvider, string[]> = {
  render: ["onrender.com"],
  tidb_cloud: ["tidbcloud.com"],
  railway: ["railway.app"],
  koyeb: ["koyeb.app"],
  manus_managed: ["manus.space"],
};

export function assertManualHostingCheckEndpoint(input: { provider: HostingProvider; endpoint: string | null }) {
  if (!input.endpoint) throw new Error("أضف رابط HTTPS للخدمة قبل اختبار الاتصال.");
  const parsed = new URL(input.endpoint);
  const hostname = parsed.hostname.toLowerCase();
  const allowed = providerEndpointDomains[input.provider].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || !allowed) {
    throw new Error("رابط الاختبار غير مسموح. استخدم نطاق HTTPS العام الذي يقدمه المزوّد المختار فقط.");
  }
  return parsed.toString();
}

export function formatHostingCheckResult(input: { status?: number; timedOut?: boolean }) {
  if (input.timedOut) return { checkStatus: "unreachable" as const, statusCode: null, summary: "انتهت مهلة اختبار الاتصال بعد 5 ثوانٍ." };
  if (typeof input.status === "number" && input.status >= 200 && input.status < 300) return { checkStatus: "reachable" as const, statusCode: input.status, summary: `استجاب الخادم بنجاح عبر HTTPS (HTTP ${input.status}).` };
  if (typeof input.status === "number") return { checkStatus: "unreachable" as const, statusCode: input.status, summary: `استجاب العنوان، لكنه أعاد HTTP ${input.status} ولا يعد جاهزاً.` };
  return { checkStatus: "unreachable" as const, statusCode: null, summary: "تعذر إكمال اتصال HTTPS بالخدمة." };
}
