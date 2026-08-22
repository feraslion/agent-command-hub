import { redactAgentPromptText } from "../lib/agent-model-policy";
import { buildPublicApisSearchUrl, parsePublicApisResponse } from "../lib/public-apis-policy";

type FetchOperation = typeof fetch;

export type PublicApisChatSearch = {
  context: string;
  notice: string;
  count: number;
};

export async function searchPublicApisForChat(query: string, fetchOperation: FetchOperation = fetch): Promise<PublicApisChatSearch> {
  const safeQuery = redactAgentPromptText(query, 160);
  if (!safeQuery) throw new Error("لم يتبق نص صالح لبحث دليل Public APIs.");
  const url = buildPublicApisSearchUrl({ query: safeQuery, https: "Yes", pageSize: 4 });
  const response = await fetchOperation(url, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  if (response.status === 429) throw new Error("حدّ دليل Public APIs البحث مؤقتاً؛ أعد المحاولة لاحقاً.");
  if (!response.ok) throw new Error(`تعذر بحث دليل Public APIs (${response.status}).`);
  const candidates = parsePublicApisResponse(await response.json());
  const context = candidates.map((item) => {
    const name = redactAgentPromptText(item.name, 128);
    const description = redactAgentPromptText(item.description, 300);
    const category = redactAgentPromptText(item.category, 80);
    return `- ${name} | ${category} | التوثيق: ${item.documentationUrl}\n  الوصف: ${description}\n  المصادقة: ${item.auth} | HTTPS: ${String(item.https)}`;
  }).join("\n");
  return {
    context: context || "لم يعثر دليل Public APIs على واجهات مناسبة ضمن البحث المحدود.",
    notice: candidates.length ? `استُخدم دليل Public APIs كمصدر قراءة منقح؛ عُرضت ${candidates.length} نتائج للوكيل.` : "لم يعثر دليل Public APIs على نتائج مناسبة ضمن البحث المحدود.",
    count: candidates.length,
  };
}
