export const promptTemplateLibrary = [
  { key: "planner", title: "Planner", arabicTitle: "المخطط", description: "ينتج خطة قابلة للتتبع مع التبعيات ونقاط القرار ومستويات الموافقة.", documentPath: "docs/prompts/planner-system-prompt-ar.md" },
  { key: "coder", title: "Coder", arabicTitle: "المبرمج", description: "ينتج مسودات مقيدة وفروقات سطرية ويصعد التعديلات الحساسة للمراجعة الثانوية.", documentPath: "docs/prompts/coder-system-prompt-ar.md" },
  { key: "qa", title: "QA", arabicTitle: "مختبر الجودة", description: "يجري تحققاً منطقياً ويرفع ملاحظات مرتبة من دون الادعاء بتشغيل الشيفرة.", documentPath: "docs/prompts/qa-system-prompt-ar.md" },
] as const;

export type PromptTemplateKey = (typeof promptTemplateLibrary)[number]["key"];

export function defaultTemplateForAgent(agentKey: string): PromptTemplateKey {
  if (agentKey === "planner" || agentKey === "requirements" || agentKey === "architect") return "planner";
  if (agentKey === "qa" || agentKey === "reviewer") return "qa";
  return "coder";
}
