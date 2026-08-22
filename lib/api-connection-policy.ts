export const apiConnectionProviderValues = ["github", "openrouter", "public_apis"] as const;
export type ApiConnectionProvider = (typeof apiConnectionProviderValues)[number];

export const apiConnectionAuthModeValues = ["oauth", "api_key", "none"] as const;
export type ApiConnectionAuthMode = (typeof apiConnectionAuthModeValues)[number];

export const apiConnectionStatusValues = ["awaiting_setup", "linked"] as const;
export type ApiConnectionStatus = (typeof apiConnectionStatusValues)[number];

export const apiConnectionCatalog: Record<ApiConnectionProvider, {
  label: string;
  authMode: ApiConnectionAuthMode;
  summary: string;
  setupCopy: string;
}> = {
  github: {
    label: "GitHub",
    authMode: "oauth",
    summary: "مستودعات وطلبات سحب ومهام تطوير ضمن صلاحيات محددة.",
    setupCopy: "يتطلب إعداد GitHub App أو OAuth App وتفويضك للمستودعات التي تختارها فقط. لا تضع رمز GitHub في هذه الشاشة.",
  },
  openrouter: {
    label: "OpenRouter",
    authMode: "api_key",
    summary: "بوابة اختيار نماذج الذكاء الاصطناعي بخيار مفتاح أو OAuth PKCE.",
    setupCopy: "يتطلب مفتاح API أو OAuth PKCE من حسابك. يُضاف المفتاح خادمياً عبر إعداد آمن، ولا يُعرض أو يُخزن في سجلات التطبيق.",
  },
  public_apis: {
    label: "Public APIs",
    authMode: "none",
    summary: "مصدر قراءة عام للبحث المحكوم عن واجهات برمجية.",
    setupCopy: "لا يحتاج هذا المصدر مفتاحاً أو حساباً. يبقى البحث ذاتياً معطلاً حتى قرارك في حملة بحث.",
  },
};

export function getApiConnectionRequest(provider: ApiConnectionProvider) {
  const config = apiConnectionCatalog[provider];
  return {
    provider,
    label: config.label,
    authMode: config.authMode,
    status: config.authMode === "none" ? "linked" as const : "awaiting_setup" as const,
  };
}
