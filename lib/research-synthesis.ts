export type ResearchClaimInput = { claim: string; evidenceExcerpt: string; reliability: "primary" | "project" | "secondary" | "untrusted"; status: "active" | "conflicted" | "rejected" };

export function buildResearchSynthesis(input: { claims: ResearchClaimInput[]; unansweredQuestions: string[] }) {
  const active = input.claims.filter((claim) => claim.status === "active");
  const trusted = active.filter((claim) => claim.reliability === "primary" || claim.reliability === "project");
  const conflicts = input.claims.filter((claim) => claim.status === "conflicted");
  return {
    summary: `جُمِع ${active.length} ادعاء نشط، منها ${trusted.length} مدعوم بمصدر أولي أو دليل مشروع.`,
    consensus: trusted.length ? trusted.map((claim) => `- ${claim.claim}`).join("\n") : "لا يوجد توافق مدعوم بعد؛ يلزم إضافة مصدر أولي أو دليل مشروع.",
    conflicts: conflicts.length ? conflicts.map((claim) => `- ${claim.claim}`).join("\n") : "لا توجد تعارضات معلّمة حالياً.",
    unknowns: input.unansweredQuestions.length ? input.unansweredQuestions.map((question) => `- ${question}`).join("\n") : "لا توجد أسئلة مفتوحة مسجلة.",
    options: active.slice(0, 5).map((claim, index) => ({ id: `option-${index + 1}`, title: claim.claim.slice(0, 120), evidence: claim.evidenceExcerpt.slice(0, 240), reliability: claim.reliability })),
  };
}
