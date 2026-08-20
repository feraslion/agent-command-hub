import { describe, expect, it } from "vitest";

import { chooseModelForRole, redactAgentPromptText } from "../lib/agent-model-policy";
import { validateAgentModelOutput } from "../server/agent-model-gateway";

describe("agent model policy", () => {
  it("يختار نموذج الدور المفضل أو البديل المعتمد فقط", () => {
    expect(chooseModelForRole("planner", ["gpt-5-mini", "gpt-5"]).model).toBe("gpt-5-mini");
    expect(chooseModelForRole("coder", ["gpt-5"]).model).toBe("gpt-5");
    expect(() => chooseModelForRole("qa", ["unapproved-model"])).toThrow("No approved model");
  });

  it("ينقح أنماط الأسرار قبل بناء إدخال النموذج", () => {
    expect(redactAgentPromptText("API_KEY=abc123 password: letmein")).toContain("API_KEY: [محجوب]");
    expect(redactAgentPromptText("API_KEY=abc123 password: letmein")).not.toContain("abc123");
  });

  it("يتحقق من عقد Planner وQA ولا يقبل مخرجاً ناقصاً", () => {
    expect(validateAgentModelOutput("planner", {
      summary: "خطة قابلة للمراجعة",
      workPlanTitle: "خطة الإطلاق",
      stages: ["متطلبات"],
      openQuestions: [],
      acceptanceCriteria: ["اختبار ناجح"],
      risks: [],
    })).toMatchObject({ workPlanTitle: "خطة الإطلاق" });
    expect(validateAgentModelOutput("qa", {
      verdict: "PASS",
      summary: "تم التحقق",
      evidence: ["سجل اختبار"],
      failedCriteria: [],
      nextAction: "مراجعة المالك",
    })).toMatchObject({ verdict: "PASS" });
    expect(() => validateAgentModelOutput("qa", { verdict: "PASS" })).toThrow();
  });
});
