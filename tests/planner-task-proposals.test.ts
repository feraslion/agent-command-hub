import { describe, expect, it } from "vitest";

import { buildPlannerTaskProposals, parsePlannerProposalCriteria } from "../lib/planner-task-proposals";

const summary = [
  "تحويل نطاق المشروع إلى خطوات قابلة للمراجعة.",
  "المراحل المقترحة:\n- تثبيت النطاق\n- مراجعة التنفيذ",
  "معايير القبول المقترحة:\n- حفظ اقتراح قابل للتحرير\n- منع إنشاء مهمة بلا قرار صريح",
  "الأسئلة المفتوحة:\n- من يراجع الناتج؟",
].join("\n\n");

describe("buildPlannerTaskProposals", () => {
  it("يحوّل مراحل خطة Planner إلى مسودات مهام قابلة للتحرير", () => {
    const drafts = buildPlannerTaskProposals({ planTitle: "خطة تجريبية", planSummary: summary });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ title: "تثبيت النطاق", priority: "high", stage: "planning" });
    expect(drafts[1].acceptanceCriteria).toEqual(["منع إنشاء مهمة بلا قرار صريح"]);
  });

  it("يرفض خطة معتمدة بلا مراحل أو معايير قابلة للتحويل", () => {
    expect(() => buildPlannerTaskProposals({ planTitle: "خطة", planSummary: "ملخص فقط" })).toThrow("does not contain reviewable stages");
  });

  it("يحلل معايير المقترح بأمان من التخزين النصي", () => {
    expect(parsePlannerProposalCriteria('["أول", "ثان"]')).toEqual(["أول", "ثان"]);
    expect(parsePlannerProposalCriteria("not-json")).toEqual([]);
  });
});
