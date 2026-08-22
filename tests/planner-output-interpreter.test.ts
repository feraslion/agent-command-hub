import { describe, expect, it } from "vitest";

import { interpretPlannerOutput } from "../lib/planner-output-interpreter";

const validOutput = {
  summary: "تجزئة العمل إلى خطوة إعداد وخطوة تحقق مع مراجعة المالك.",
  workPlanTitle: "خطة تحسين Runtime",
  stages: ["تحليل الحدود", "إنشاء اقتراح قابل للمراجعة"],
  openQuestions: ["هل يربط الاختبار بجهاز المالك الآن؟"],
  acceptanceCriteria: ["وجود اقتراح خطة قيد المراجعة", "عدم تطبيق أي تغيير تلقائياً"],
  risks: ["لا يوجد دليل Runner فعلي بعد"],
};

describe("interpretPlannerOutput", () => {
  it("ينشئ خطة قيد المراجعة ودليلاً مقترحاً من مخرج Planner صالح", () => {
    const result = interpretPlannerOutput(validOutput);
    expect(result.workPlan.status).toBe("review");
    expect(result.workPlan.summary).toContain("المراحل المقترحة");
    expect(result.artifact.kind).toBe("planner_proposal");
    expect(result.reviewNotice).toContain("لم تُنشأ مهام");
  });

  it("يرفض المخرج الذي لا يملك مرحلة أو معيار قبول قابلاً للمراجعة", () => {
    expect(() => interpretPlannerOutput({ ...validOutput, stages: [] })).toThrow("at least one planned stage");
    expect(() => interpretPlannerOutput({ ...validOutput, acceptanceCriteria: [] })).toThrow("at least one acceptance criterion");
  });

  it("ينقح القيم الحساسة ويزيل التكرار قبل حفظ الاقتراح", () => {
    const result = interpretPlannerOutput({
      ...validOutput,
      risks: ["token=live-secret", "token=live-secret"],
    });
    expect(result.workPlan.summary).toContain("token: [محجوب]");
    expect(result.workPlan.summary.match(/token: \[محجوب\]/g)).toHaveLength(1);
  });
});
