import { redactAgentPromptText, type AgentModelRole } from "./agent-model-policy";

export function buildAgentRunOwnerAlert(input: { role: AgentModelRole; status: "completed" | "failed"; summary: string; artifactCreated?: boolean }) {
  const role = input.role === "planner" ? "المخطط" : input.role === "coder" ? "المبرمج" : input.role === "qa" ? "ضمان الجودة" : input.role === "reviewer" ? "المراجع" : "المصحح";
  const safeSummary = redactAgentPromptText(input.summary, 500);
  if (input.status === "failed") return { title: `فشل دور الوكيل: ${role}`, content: `${safeSummary} لم يُطبق أي تغيير، وحُرر حجز التكلفة إن كان ما زال نشطاً.` };
  return { title: `اكتمل دور الوكيل: ${role}`, content: `${safeSummary}${input.artifactCreated ? " حُفظ ملف دليل منقح للمراجعة." : " راجع المخرج المنظم في الحوكمة."}` };
}
