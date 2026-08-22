import { createHmac } from "node:crypto";

export const PUBLIC_APIS_ORIGIN = "https://publicapis-vmuetrsw.manus.space";
export const PUBLIC_APIS_SEARCH_PATH = "/api/v1/apis/search";

export type PublicApisSearchInput = { query?: string; category?: string; auth?: "No" | "apiKey" | "OAuth"; https?: "Yes" | "No"; pageSize?: number };
export type PublicApiCandidate = { name: string; description: string; category: string; auth: string; https: boolean | string; cors: boolean | string; documentationUrl: string };

function cleanValue(value: string | undefined, max: number) {
  return value?.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max) || undefined;
}

export function buildPublicApisSearchUrl(input: PublicApisSearchInput) {
  const url = new URL(PUBLIC_APIS_SEARCH_PATH, PUBLIC_APIS_ORIGIN);
  const query = cleanValue(input.query, 160);
  const category = cleanValue(input.category, 80);
  if (query) url.searchParams.set("query", query);
  if (category) url.searchParams.set("category", category);
  if (input.auth) url.searchParams.set("auth", input.auth);
  if (input.https) url.searchParams.set("https", input.https);
  url.searchParams.set("pageSize", String(Math.min(Math.max(input.pageSize ?? 8, 1), 20)));
  return url;
}

export function publicApisOperationFingerprint(secret: string, input: { ownerId: number; projectId: number; campaignId: number }) {
  if (!secret) throw new Error("لا يتوفر سر خادم لإنشاء مفتاح تشغيل البحث الذاتي.");
  return createHmac("sha256", secret).update(`public-apis-autonomy:${input.ownerId}:${input.projectId}:${input.campaignId}`).digest("hex").slice(0, 16);
}

function asString(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max) : "";
}

export function parsePublicApisResponse(value: unknown): PublicApiCandidate[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { data?: unknown }).data)) throw new Error("استجابة دليل Public APIs غير متوافقة.");
  return (value as { data: unknown[] }).data.map((item) => {
    const row = item as Record<string, unknown>;
    const documentationUrl = asString(row.link ?? row.documentationUrl ?? row.url, 1024);
    if (!documentationUrl.startsWith("https://")) return null;
    return { name: asString(row.api ?? row.name, 128), description: asString(row.description, 500), category: asString(row.category, 80), auth: asString(row.auth, 32) || "Unknown", https: typeof row.https === "boolean" ? row.https : asString(row.https, 12), cors: typeof row.cors === "boolean" ? row.cors : asString(row.cors, 12), documentationUrl };
  }).filter((item): item is PublicApiCandidate => Boolean(item?.name && item.documentationUrl));
}
