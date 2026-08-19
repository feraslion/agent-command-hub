export type SensitiveChangeAssessment = { sensitive: boolean; reasons: string[] };

const sensitiveSignals: Array<{ expression: RegExp; label: string }> = [
  { expression: /\b(child_process|exec|spawn|eval|process\.env)\b/i, label: "تنفيذ أو وصول إلى عملية/بيئة النظام" },
  { expression: /\b(fetch|axios|token|secret|password|api[ _-]?key)\b/i, label: "شبكة أو بيانات اعتماد محتملة" },
  { expression: /\b(permission|auth|security|rm\s+-rf|delete|git)\b/i, label: "صلاحيات أو حذف أو تكامل خارجي" },
];

export function assessSensitiveWorkspaceChange(path: string, previousContent: string, proposedContent: string): SensitiveChangeAssessment {
  if (!path.startsWith("source/") || previousContent === proposedContent) return { sensitive: false, reasons: [] };
  const changedText = proposedContent.toLowerCase();
  const reasons = sensitiveSignals.filter((signal) => signal.expression.test(changedText)).map((signal) => signal.label);
  return { sensitive: reasons.length > 0, reasons };
}
